from __future__ import absolute_import, division, print_function

import glob
import json
import re
import numpy as np
from dotmap import DotMap

def load_data(max_count):
    data = load_raw_data(max_count)
    inputs_text = []
    inputs_extra = []
    outputs = []
    for argument in data:
        text = get_text(argument)
        for speaker in text:
            if not "sideBefore" in speaker: continue
            if speaker.sideBefore == "petitioner":
                id_vec = [1, 0, 0]
            elif speaker.sideBefore == "respondent":
                id_vec = [0, 1, 0]
            else:
                id_vec = [0, 0, 1]
            inputs_text.append(speaker.text)
            inputs_extra.append(id_vec)
            petitioner_output = 1 if argument.outcome.side == "petitioner" else 0
            respondent_output = 1 if argument.outcome.side == "respondent" else 0
            outputs.append([petitioner_output, respondent_output])

    return [inputs_text, inputs_extra, outputs]

def load_raw_data(max_count):
    data = []

    count = 0
    for filename in glob.glob("../arguments/*.json"):
        with open(filename) as data_file:
            argument = DotMap( json.load(data_file) )
            data.append(argument)

        count += 1
        if max_count >= 0 and count > max_count:
            break

    return data

def get_text(argument):
    for speaker in argument.speakers:
        text = speaker.text
        text = re.sub(r"[^A-Za-z0-9(),!?\'\`]", " ", text) # non alphanumeric or puncutation symbols removed
        text = re.sub(r"\'s", " \'s", text) # sufixes
        text = re.sub(r"\'ve", " \'ve", text)
        text = re.sub(r"n\'t", " n\'t", text)
        text = re.sub(r"\'re", " \'re", text)
        text = re.sub(r"\'d", " \'d", text)
        text = re.sub(r"\'ll", " \'ll", text)
        text = re.sub(r",", " , ", text) # space around punctuation
        text = re.sub(r"!", " ! ", text)
        text = re.sub(r"\(", " \( ", text)
        text = re.sub(r"\)", " \) ", text)
        text = re.sub(r"\?", " \? ", text)
        text = re.sub(r"(\D)(\d+)(\D)", "\1 \2 \3", text)
        text = re.sub(r"\s{2,}", " ", text) # condense whitespace
        speaker.text = text.strip().lower()
    return argument.speakers # capitalization not important

def batches(text_data, extra_data, output_data, batch_size, num_epochs, shuffle=True):
    data = np.array(list(zip(text_data, extra_data, output_data)))
    data_size = len(data)
    num_batches_per_epoch = int(data_size / batch_size) + 1

    for epoch in range(num_epochs):
        # Shuffle
        if shuffle:
            shuffle_indices = np.random.permutation(np.arange(data_size))
            shuffled_data = data[shuffle_indices]
        else:
            shuffled_data = data
        for batch_num in range(num_batches_per_epoch):
            start_index = batch_num * batch_size
            end_index = min((batch_num + 1) * batch_size, data_size)
            yield shuffled_data[start_index : end_index]
