#!/usr/bin/env python3
"""Prepare a reproducible, blinded review sample from a complete private CSV extract."""
import argparse
import csv
import json
import random
from pathlib import Path

PILOT = 'pilot-1.0'
PROMPT = 'physical-target-suggestions-7'
TYPES = [f'{target}_{form}' for target in ('sensory_discriminative','affective_motivational') for form in ('direct','imagery','metaphorical')]

def safe(value):
    value = str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) else value

def prepare(source, output, seed=20261116, per_cell=5):
    groups = {key: [] for key in TYPES}
    seen = set()
    with Path(source).open(newline='', encoding='utf-8-sig') as handle:
        reader = csv.DictReader(handle)
        required = {'pilot_version','prompt_version','suggestion_id','suggestion_type','exact_text'}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError('The suggestions CSV is missing required columns.')
        for row in reader:
            if row['pilot_version'] != PILOT or row['prompt_version'] != PROMPT:
                continue
            if row['suggestion_id'] in seen:
                raise ValueError('Duplicate suggestion IDs: check concatenation of export pages.')
            seen.add(row['suggestion_id'])
            if row['suggestion_type'] in groups and row['exact_text'].strip():
                groups[row['suggestion_type']].append(row)
    rng = random.Random(seed)
    chosen = []
    for kind in TYPES:
        rows = sorted(groups[kind], key=lambda row: row['suggestion_id'])
        chosen.extend(rng.sample(rows, min(per_cell, len(rows))))
    rng.shuffle(chosen)
    output = Path(output)
    names = ('content_review.csv','content_review_key.csv','review_manifest.json')
    if any((output / name).exists() for name in names):
        raise ValueError('Review outputs already exist; choose a new output directory.')
    output.mkdir(parents=True, exist_ok=True)
    fields = ['review_code','exact_text','reviewer_code','perceived_target','perceived_form','imagery_comparison','repeated_wording','safety_concern','clarity_1_to_5','notes']
    with (output/names[0]).open('x',newline='',encoding='utf-8') as review, (output/names[1]).open('x',newline='',encoding='utf-8') as key:
        rw,kw=csv.writer(review),csv.writer(key)
        rw.writerow(fields)
        kw.writerow(['review_code','suggestion_id','assigned_type'])
        for index,row in enumerate(chosen,1):
            code=f'R{index:03d}'
            rw.writerow([code,safe(row['exact_text'])]+['']*(len(fields)-2))
            kw.writerow([code,safe(row['suggestion_id']),row['suggestion_type']])
    manifest={'pilot_version':PILOT,'prompt_version':PROMPT,'seed':seed,'per_cell':per_cell,'selected':len(chosen),'available_by_cell':{key:len(rows) for key,rows in groups.items()},'selected_by_cell':{key:sum(row['suggestion_type']==key for row in chosen) for key in TYPES}}
    (output/names[2]).write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    return manifest

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--suggestions',required=True)
    parser.add_argument('--out',required=True)
    parser.add_argument('--seed',type=int,default=20261116)
    parser.add_argument('--per-cell',type=int,default=5)
    args=parser.parse_args()
    if not 1 <= args.per_cell <= 100:
        parser.error('--per-cell must be between 1 and 100')
    try:
        result=prepare(args.suggestions,args.out,args.seed,args.per_cell)
    except (ValueError,OSError) as error:
        parser.exit(1,f'{error}\n')
    print(f"Prepared {result['selected']} review records. Keep review text and assignment key separate.")
