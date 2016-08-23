import tensorflow as tf
import numpy as np
import os
import shutil
import json
from dotmap import DotMap
import time

import processor
from model import Model

# Command-line parameters
tf.flags.DEFINE_boolean("predict_margin", False, "Predict win margin instead of winning side (default: false)")
tf.flags.DEFINE_integer("num_justices", 9, "Number of justices on the court (default: 9)")
tf.flags.DEFINE_string("case", "", "Case to predict")
tf.flags.DEFINE_string("dir", "", "Directory to read network from")
tf.flags.DEFINE_string("arguments_dir", "arguments/", "Directory to read parsed arguments from")

F = tf.flags.FLAGS
F._parse_flags()

# Get data
print("Loading case...") 
filename = os.path.join(os.getcwd(), F.arguments_dir, "{}.json".format(F.case))
with open(filename) as case_file:
    argument = DotMap( json.load(case_file) )
    pet = argument.side_summaries[0]
    resp = argument.side_summaries[1]
    jus = argument.side_summaries[2]
    print(pet)
    p_words = float(pet.words_spoken)
    r_words = float(resp.words_spoken)
    j_words = float(jus.words_spoken)
    x = np.array([[
            float(pet.interruptions) / p_words,
            float(pet.times_spoken) / p_words,
            float(pet.laughter) / p_words,
            float(len(argument.petitioner.counsel)),
            float(pet.num_int_by),
            float(resp.interruptions) / r_words,
            float(resp.times_spoken) / r_words,
            float(resp.laughter) / r_words,
            float(len(argument.respondent.counsel)),
            float(resp.num_int_by),
            float(jus.interruptions) / j_words,
            float(jus.times_spoken) / j_words,
            float(jus.laughter) / j_words,
            float(F.num_justices),
            float(jus.num_int_by),
        ]])
print("Case loaded.")

print("Initializing model...")
checkpoint_file = tf.train.latest_checkpoint(F.dir)
print("Reading checkpoint from {}".format(checkpoint_file))
graph = tf.Graph()
with graph.as_default():
    with tf.Session() as session:
        # load network
        saver = tf.train.import_meta_graph("{}.meta".format(checkpoint_file))
        saver.restore(session, checkpoint_file)
        
        # find input and output tensors 
        input_x = graph.get_operation_by_name("input/input_x").outputs[0]
        dropout_prob = graph.get_operation_by_name("dropout_probability").outputs[0]
        predictions = graph.get_operation_by_name("output/win_predictions").outputs[0]
        probabilities = graph.get_operation_by_name("output/win_probabilities").outputs[0]
        print("Model initialized.\n")

        feed_data = {
                input_x: x,
                dropout_prob: 1.0,
                }
        predictions, probabilities = session.run([predictions, probabilities], feed_data)

        print("=========")
        print("Petitioner ({}): {:g}% chance"
                .format(argument.petitioner.name, probabilities[0][0]*100))
        print("Respondent ({}): {:g}% chance"
                .format(argument.respondent.name, probabilities[0][1]*100))
        print("=========")
