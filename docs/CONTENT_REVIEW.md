# Independent content review

Use the same complete, investigator-only `suggestions` CSV extract used for analysis. Run locally, choosing a protected output directory outside the repository:

```sh
python3 scripts/prepare_review.py --suggestions /secure/extract/suggestions.csv --out /secure/review/pilot-1
```

The script samples up to five suggestions per Pilot 1.0 cell using seed 20261116 (at most 30), retaining partial-session/unrated suggestions. It writes:

- `content_review.csv`: review codes, exact text and blank review fields. No assigned target/form is shown.
- `content_review_key.csv`: a separate restricted key linking codes to suggestion IDs and assigned labels.
- `review_manifest.json`: seed, cohort identifiers, available/selected counts per cell.

Give two independent reviewers separate copies of the first file without the key. Ask each to classify the perceived target (`sensory_discriminative`, `affective_motivational`, `mixed`, `unclear`) and form (`direct`, `imagery`, `metaphorical`, `mixed`, `unclear`), and record yes/no/unclear for imagery comparisons, repeated wording and safety concerns. Rate clarity from 1 (hard to understand) to 5 (very clear); this is a local review rubric, not a validated measure. Use notes without participant identifiers.

After independent ratings, compare with the assignment key, report agreement/disagreements and document adjudication without overwriting original reviews. A flag is a reason to inspect content, not permission to discard an inconvenient resonance score. Amendments to generation require a new protocol/prompt/pilot version. Do not upload participant texts to public issues or unrelated external services.
