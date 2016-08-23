import tensorflow as tf
import numpy as np
import os
import shutil
import time
import processor

# Command-line parameters
tf.flags.DEFINE_integer("k", 5, "Number of nearest neighbors to use in prediction (default: 5)")
tf.flags.DEFINE_integer("max_data", -1, "Maximum number of data points to use")
tf.flags.DEFINE_string("data_file", "data/features.csv", 
            "File to read data from (default: 'data/features.csv')")

F = tf.flags.FLAGS
F._parse_flags()

# Get data
print("Loading data...")
x, y  = processor.load_data(F.data_file, F.max_data)
print("Data loaded.")

print("Preparing data...")
x = np.array(x)
y = np.array(y)
num_features = x.shape[1]

# split train vs  test
amount = int(0.1 * len(x))
x_train, x_eval = x[:-amount], x[-amount:]
y_train, y_eval = y[:-amount], y[-amount:]
print("Data prepared.")

known = tf.placeholder("float32", [None, num_features])
new = tf.placeholder("float32", [num_features])
distance = tf.reduce_sum(tf.abs(known - new), reduction_indices=1)
nearest, indices = tf.nn.top_k(distance, F.k)

correct = 0
with tf.Session() as session:
    session.run(tf.initialize_all_variables())

    # for all test data
    length = len(x_eval)
    for i in range(length):
        feed_data = {
                known: x_train,
                new: x_eval[i, :],
            }
        nearest_indices = session.run(indices, feed_data)

        # compute accuracy
        predicted = tf.round(tf.reduce_mean(tf.cast(
            tf.argmax(y_train[nearest_indices], 1), 
            "float"))).eval()
        actual = np.argmax(y_eval[i, :])
        correct += float(1 - abs(predicted - actual))

    print("Accuracy: {:g}%".format(100 * correct/length))
