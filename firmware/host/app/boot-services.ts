import {
  type BootWiFiRecoveryChoice,
  bootWiFiFailureMessage,
  networkReadyResultForRecoveryChoice,
  shouldRetryBootWiFiAttempt,
} from 'boot-network-recovery'
import type { NetworkReadyResult } from 'capabilities'
import { createLocalPeerCapability } from 'local-peer-capability'
import type { LocalPeerCapability } from 'local-peer-types'
import { localize } from 'localization'
import config from 'mc/config'
import { connectStoredWiFi, stopStoredWiFiConnection } from 'stored-wifi'
import Timer from 'timer'

export type { NetworkReadyResult } from 'capabilities'

export type HostBootServices = {
  close(): void
  connectivity: {
    network: {
      ready: Promise<NetworkReadyResult>
    }
    localPeer?: LocalPeerCapability
  }
}

export type BootWiFiStatus = {
  attempt: number
  maxAttempts: number
  message: string
}

export type HostBootServicesOptions = {
  wifi?: {
    retryInBackground?: boolean
    attemptTimeoutMs?: number
    maxAttempts?: number
    retryDelayMs?: number
    onStatusChanged?: (status: BootWiFiStatus) => void
    promptRecoveryChoice?: (status: BootWiFiStatus & { reason: string }) => Promise<BootWiFiRecoveryChoice>
  }
}

type BootWiFiConfig = {
  ssid?: unknown
  password?: unknown
}

type BootConfig = {
  wifi?: BootWiFiConfig
}

const NOT_STARTED: NetworkReadyResult = {
  status: 'skipped',
  reason: 'host boot services not started',
}
const DEFAULT_BOOT_WIFI_MAX_ATTEMPTS = 3
const DEFAULT_BOOT_WIFI_RETRY_DELAY_MS = 500

type BootConnectionLifetime = {
  closed: boolean
  cancel?: () => void
}

let bootServices: HostBootServices = {
  close() {},
  connectivity: {
    network: {
      ready: Promise.resolve(NOT_STARTED),
    },
  },
}

export function startHostBootServices(options: HostBootServicesOptions = {}): HostBootServices {
  const lifetime: BootConnectionLifetime = { closed: false }
  const localPeer = createLocalPeerCapability()
  const networkReady = startStoredWiFi(lifetime, options.wifi)
  bootServices = {
    close() {
      if (lifetime.closed) return
      lifetime.closed = true
      lifetime.cancel?.()
      stopStoredWiFiConnection()
    },
    connectivity: {
      network: {
        ready: networkReady,
      },
      localPeer,
    },
  }
  return bootServices
}

export function getHostBootServices(): HostBootServices {
  return bootServices
}

async function startStoredWiFi(
  lifetime: BootConnectionLifetime,
  options: NonNullable<HostBootServicesOptions['wifi']> = {},
): Promise<NetworkReadyResult> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_BOOT_WIFI_MAX_ATTEMPTS
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_BOOT_WIFI_RETRY_DELAY_MS
  for (;;) {
    if (lifetime.closed) return { status: 'skipped', reason: 'host boot services closed' }
    let lastReason = 'connection failed'
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      options.onStatusChanged?.({
        attempt,
        maxAttempts,
        message: localize('splash.connecting', { attempt, maxAttempts }),
      })
      const result = await connectStoredWiFiOnce(lifetime, options.attemptTimeoutMs ?? 20000)
      if (lifetime.closed) return { status: 'skipped', reason: 'host boot services closed' }
      if (result.status !== 'failed') {
        return result
      }
      lastReason = result.reason
      trace(`[network] boot Wi-Fi attempt ${attempt}/${maxAttempts} failed: ${lastReason}\n`)
      if (shouldRetryBootWiFiAttempt(attempt, maxAttempts)) {
        await waitForRetry(lifetime, retryDelayMs)
        if (lifetime.closed) return { status: 'skipped', reason: 'host boot services closed' }
      }
    }

    if (options.retryInBackground) {
      await waitForRetry(lifetime, retryDelayMs)
      continue
    }
    const message = bootWiFiFailureMessage(lastReason)
    if (!options.promptRecoveryChoice) {
      return { status: 'failed', reason: lastReason }
    }
    const choice = await options.promptRecoveryChoice({
      attempt: maxAttempts,
      maxAttempts,
      message,
      reason: lastReason,
    })
    const result = networkReadyResultForRecoveryChoice(choice, lastReason)
    if (result) {
      trace(`[network] ${result.reason}\n`)
      return result
    }
    trace('[network] retrying Wi-Fi by user request\n')
  }
}

function waitForRetry(lifetime: BootConnectionLifetime, milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      Timer.clear(timer)
      lifetime.cancel = undefined
      resolve()
    }
    const timer = Timer.set(finish, milliseconds)
    lifetime.cancel = finish
  })
}

function connectStoredWiFiOnce(lifetime: BootConnectionLifetime, timeoutMs: number): Promise<NetworkReadyResult> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: NetworkReadyResult) => {
      if (settled) return
      settled = true
      Timer.clear(timeout)
      lifetime.cancel = undefined
      if (result.status !== 'connected') {
        stopStoredWiFiConnection()
      }
      resolve(result)
    }

    const timeout = Timer.set(() => finish({ status: 'failed', reason: 'connection timeout' }), timeoutMs)
    lifetime.cancel = () => finish({ status: 'skipped', reason: 'host boot services closed' })
    try {
      stopStoredWiFiConnection()
      const started = connectStoredWiFi({
        ...getBootWiFiCredentials(),
        scanBeforeConnect: true,
        onConnected: () => finish({ status: 'connected' }),
        onError: (reason) => {
          const message = reason ?? 'connection failed'
          trace(`[network] connection failed: ${message}\n`)
          finish({ status: 'failed', reason: message })
        },
      })
      if (!started) {
        finish({ status: 'skipped', reason: 'missing Wi-Fi credentials' })
      }
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
      trace(`[network] connection failed: ${message}\n`)
      finish({ status: 'failed', reason: message })
    }
  })
}

function getBootWiFiCredentials(): { ssid?: string; password?: string } {
  const bootConfig = config as BootConfig
  const wifi = bootConfig.wifi ?? {}
  const ssid = wifi.ssid
  const password = wifi.password
  return {
    ssid: typeof ssid === 'string' ? ssid : undefined,
    password: typeof password === 'string' ? password : undefined,
  }
}
