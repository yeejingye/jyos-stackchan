import unittest
from sweep import summarize


def recording():
    events = []
    names = ['baseline', 'balanced', 'smooth', 'responsive', 'responsive', 'smooth', 'balanced', 'baseline']
    errors = {'baseline': .2, 'balanced': .06, 'smooth': .15, 'responsive': .12}
    for stage, name in enumerate(names):
        events.append(dict(event='stage', stage=stage, profile={'name': name}))
        for t in range(0, 20000, 200):
            events.append(dict(event='sample', stage=stage, elapsedMs=stage * 20000 + t,
                               face=dict(x=.5 + errors[name], y=.5, confidence=.99),
                               inferenceMs=150, commandMs=0, rotation=dict(y=0, p=0),
                               commanded=False, duration=0))
    events.append(dict(event='end', completed=True))
    return events


class AnalysisTest(unittest.TestCase):
    def test_selects_tracking_quality_even_when_all_candidates_hold_perfectly_still(self):
        self.assertEqual(summarize(recording())['recommendedProfile'], 'balanced')

    def test_incomplete_run_never_selects_a_default(self):
        events = recording()[:-1]
        self.assertIsNone(summarize(events)['recommendedProfile'])

    def test_missing_faces_do_not_win_by_making_no_corrections(self):
        events = recording()
        for e in events:
            if e['event'] == 'sample' and e['stage'] in (1, 6):
                e['face'] = None
        self.assertIsNone(summarize(events)['recommendedProfile'])

    def test_fatal_error_invalidates_a_run(self):
        events = recording() + [dict(event='error', stage=1, error='servo failure')]
        self.assertIsNone(summarize(events)['recommendedProfile'])

    def test_small_score_difference_keeps_baseline(self):
        events = recording()
        for e in events:
            if e['event'] == 'sample' and e['stage'] in (0, 7):
                e['face']['x'] = .563
        self.assertEqual(summarize(events)['recommendedProfile'], 'baseline')


if __name__ == '__main__':
    unittest.main()
