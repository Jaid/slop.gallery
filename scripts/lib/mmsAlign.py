# /// script
# requires-python = ">=3.13"
# dependencies = ["numpy==2.5.5", "torch==2.15.0", "torchaudio==2.11.1"]
#
# [tool.uv.sources]
# torch = {index = "pytorch-cpu"}
# torchaudio = {index = "pytorch-cpu"}
#
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# ///
"""Letter-exact forced alignment with Meta’s MMS aligner (torchaudio’s MMS_FA bundle), for scripts/alignNarrations.ts.

Reads [{id, samples, text}] as JSON from stdin, where samples is a file of mono 16 kHz float32 little-endian PCM, and writes
[{id, characters}] to stdout: one [start, end] in seconds per character of text, null for characters the aligner has no label for.
"""

import json
import sys

import numpy
import torch
import torchaudio

bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model(with_star=False).eval()
dictionary = bundle.get_dict(star=None)
# MMS emits one frame per 320 samples at 16 kHz.
frame_seconds = 320 / bundle.sample_rate


def label(character):
    folded = character.lower().replace('\u2019', "'")
    return dictionary.get(folded) if folded != '-' else None


results = []
for item in json.load(sys.stdin):
    text = item['text']
    indices = [index for index, character in enumerate(text) if label(character) is not None]
    waveform = torch.from_numpy(numpy.fromfile(item['samples'], dtype='<f4')).unsqueeze(0)
    with torch.inference_mode():
        emission, _ = model(waveform)
        emission = torch.log_softmax(emission, dim=-1)
    targets = torch.tensor([[label(text[index]) for index in indices]], dtype=torch.int32)
    alignment, scores = torchaudio.functional.forced_align(emission, targets, blank=0)
    spans = torchaudio.functional.merge_tokens(alignment[0], scores[0].exp())
    characters = [None] * len(text)
    for index, span in zip(indices, spans, strict=True):
        characters[index] = [round(span.start * frame_seconds, 3), round(span.end * frame_seconds, 3)]
    results.append({'id': item['id'], 'characters': characters})
json.dump(results, sys.stdout)
