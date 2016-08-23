import tensorflow as tf
import numpy as np
import os
import shutil
import time
import processor

# Command-line parameters
tf.flags.DEFINE_float("c", 1, "C parameter of SVM cost function (default: 1)")
tf.flags.DEFINE_integer("max_data", -1, "Maximum number of data points to use")
tf.flags.DEFINE_integer("batch_size", 10, "Batch size (default: 10)")
tf.flags.DEFINE_integer("num_epochs", 20, "Number of times to run through training data (default: 20)")
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
y = np.array(y)[:,:1] * 2 - 1
num_features = x.shape[1]

# split train vs  test
amount = int(0.1 * len(x))
x_train, x_eval = x[:-amount], x[-amount:]
y_train, y_eval = y[:-amount], y[-amount:]
print("Data prepared.")

x = tf.placeholder("float32", [None, num_features])
y = tf.placeholder("float32", [None, 1])

weights = tf.Variable(
        tf.truncated_normal([num_features, 1], stddev=50),
        name="weights"
    )
bias = tf.Variable(
        tf.constant(0.0, shape=[1]),
        name = "bias"
    )
y_raw = tf.matmul(x, weights) + bias

regularization_loss = tf.reduce_sum(tf.square(weights)) 
hinge_loss = tf.reduce_sum(tf.nn.relu(1 - y*y_raw))
svm_loss = regularization_loss/F.c + hinge_loss
train_operation = tf.train.AdamOptimizer(0.1).minimize(svm_loss)

# Evaluation.
predicted_class = tf.sign(y_raw);
correct_prediction = tf.equal(y, predicted_class)
accuracy = tf.reduce_mean(tf.cast(correct_prediction, "float"))

with tf.Session() as session:
    session.run(tf.initialize_all_variables())

    def train_step(x_batch, y_batch):
        feed_data = {
                x: x_batch,
                y: y_batch
            }

        loss_val, accuracy_val = session.run([svm_loss, accuracy], feed_data)

        print("TRAIN:  Loss {:g}  Accuracy {:g}%"
                .format(loss_val, accuracy_val*100))

    def eval_step(x_batch, y_batch):
        feed_data = {
                x: x_batch,
                y: y_batch
            }

        loss_val, accuracy_val = session.run([svm_loss, accuracy], feed_data)

        print("\nEVAL:   Loss {:g}  Accuracy {:g}%\n"
                .format(loss_val, accuracy_val*100))


    # Training loop
    eval_step(x_eval, y_eval)
    for batch in processor.batches(x_train, y_train, F.batch_size, F.num_epochs):
        x_batch, y_batch = zip(*batch)

        train_step(x_batch, y_batch)

    eval_step(x_eval, y_eval)

