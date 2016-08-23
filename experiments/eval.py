import tensorflow as tf
import numpy as np
import os
import shutil
import time

import processor
from model import Model

# Command-line parameters
tf.flags.DEFINE_boolean("eval_all", False, "Evaluate on all data (default: false)")
tf.flags.DEFINE_string("dir", "", "Directory to read network from")
tf.flags.DEFINE_string("data_file", "data/features.csv", 
            "File to read data from (default: 'data/features.csv')")

F = tf.flags.FLAGS
F._parse_flags()

# Get data
print("Loading data...")
x, y  = processor.load_data(F.data_file)
print("Data loaded.")

print("Preparing data...")
if F.eval_all:
    x = np.array(x)
    y = np.array(y)
else:
    amount = int(0.1 * len(x))
    x = np.array(x)[-amount:]
    y = np.array(y)[-amount:]
print("Data prepared.")

print("Initializing model...")
checkpoint_file = tf.train.latest_checkpoint(os.path.join(F.dir, "checkpoints"))
print("Reading checkpoint from {}".format(checkpoint_file))
graph = tf.Graph()
with graph.as_default():
    with tf.Session() as session:
        # load network
        saver = tf.train.import_meta_graph("{}.meta".format(checkpoint_file))
        saver.restore(session, checkpoint_file)
        
        # find input and output tensors 
        input_x = graph.get_operation_by_name("input/input_x").outputs[0]
        output_y = graph.get_operation_by_name("output_y").outputs[0]
        predictions = graph.get_operation_by_name("output/predictions").outputs[0]
        print("Model initialized.\n")

        feed_data = {
                input_x: x,
                }
        predictions  = session.run(
                predictions, 
                feed_data)

        length = len(x)
        print(y[:,1:2].flatten())
        print(predictions)
        correct_predictions = float(sum(predictions == y[:,1:2].flatten()))
        accuracy = 100 * correct_predictions / length

        print("Evaluated {} cases.".format(length))
        print("Accuracy {}%".format(accuracy))
