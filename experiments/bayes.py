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

count_petitioner = float(np.sum(y_train, axis=0)[0])
count_respondent = len(y_train) - count_petitioner
prob_petitioner = count_petitioner / len(y_train)
prob_respondent = count_respondent / len(y_train)

known = tf.placeholder("float32", [None, num_features])
new = tf.placeholder("float32", [num_features])
distance = tf.reduce_sum(tf.abs(known - new), reduction_indices=1)
nearest, indices = tf.nn.top_k(distance, F.k)

correct = 0
precision = 0
n_precision = 0
recall = 0
n_recall = 0
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
        counts = tf.argmax(y_train[nearest_indices], 1)
        num_respondent = float(tf.reduce_sum(counts).eval())
        num_petitioner = F.k - num_respondent

        likelihood_petitioner = num_petitioner / count_petitioner
        likelihood_respondent = num_respondent / count_respondent

        unnorm_petitioner = prob_petitioner * likelihood_petitioner
        unnorm_respondent = prob_respondent * likelihood_respondent
        norm_constant = unnorm_petitioner + unnorm_respondent

        post_petitioner = unnorm_petitioner / norm_constant
        post_respondent = unnorm_respondent / norm_constant

        actual = np.argmax(y_eval[i, :])
        predicted = 0 if post_petitioner >  post_respondent else 1
        print([predicted, actual])
        adj_amt = float(1 - abs(predicted - actual))
        correct += adj_amt
        if predicted == 1:
            n_precision += 1
            precision += adj_amt
        if actual == 1:
            n_recall += 1
            recall += adj_amt

    print("Accuracy: {:g}%".format(100 * correct/length))
    print("Precision: {:g}%".format(100 * precision/n_precision))
    print("Recall: {:g}%".format(100 * recall/n_recall))
