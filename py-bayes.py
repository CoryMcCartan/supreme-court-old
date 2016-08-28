import tensorflow as tf
import numpy as np
import os
import csv
import shutil
import time
import experiments/processor

# Command-line parameters
tf.flags.DEFINE_integer("max_data", -1, "Maximum number of data points to use")
tf.flags.DEFINE_string("data_file", "data/features.csv", 
            "File to read data from (default: 'data/features.csv')")
tf.flags.DEFINE_string("thresholds_file", "data/thresholds.csv", 
            "File to read thresholds from (default: 'data/thresholds.csv')")

F = tf.flags.FLAGS
F._parse_flags()

# Get data
print("Loading data...")
x = []
y = []
with open(F.data_file) as data_csv:
    reader = csv.DictReader(data_csv)
    for row in reader:
        x.append([
            float(row["p_minus_r"]),
            float(row["p_interruptions"]),
            float(row["p_words"]),
            float(row["p_times"]),
            float(row["p_laughter"]),
            int(row["p_num_counsel"]),
            int(row["p_num_int_by"]),
            float(row["r_interruptions"]),
            float(row["r_words"]),
            float(row["r_times"]),
            float(row["r_laughter"]),
            int(row["r_num_counsel"]),
            int(row["r_num_int_by"]),
            float(row["j_interruptions"]),
            float(row["j_words"]),
            float(row["j_times"]),
            float(row["j_laughter"]),
            int(row["j_num"]),
            int(row["j_num_int_by"])
        ])
        y.append([int(row["side"]), 1 - int(row["side"])])

thresholds = {}
with open(F.thresholds_file) as t_csv:
    reader = csv.DictReader(t_csv)
    for row in reader:
        thresholds[row.key] = float(row.threshold)

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

thresholds = np.array(thresholds)
thresh_tensor = tf.Variable(tf.constant(thresholds))

input_x = tf.placeholder(tf.float32, [None, num_features])
output = tf.placeholder(tf.float32, [None, 2])
split = (1 + tf.sign(input_x - thresh_tensor)) / 2
weights = tf.Variable(
    tf.truncated_normal([num_features, 2], stddev=0.5),
    name="weights_output"
        )
scores = tf.matmul(split, weights)
probabilities = tf.nn.softmax(scores, name="probabilities")
predictions = tf.argmax(probabilities, dimension=1, name="predictions")

loss = tf.reduce_mean(tf.abs(probabilities -  output)
correct_predictions = tf.equal(predictions, tf.argmax(output, 1))
accuracy = 100 * tf.reduce_mean(tf.cast(correct_predictions, "float"), name="value")

with tf.Session() as session:
    session.run(tf.initialize_all_variables())

    # for all test data
    length = len(x_eval)
    for i in range(length):
        feed_data = {
                input_x: x_train,
                output: y_train,
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
