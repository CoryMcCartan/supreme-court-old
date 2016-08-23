import tensorflow as tf
import numpy as np
import os
import shutil
import time

import processor
from log_reg import Model

# Command-line parameters
tf.flags.DEFINE_string("hidden_layer_sizes", "9", "Comma-separated list of hidden layer sizes (default: '9')")
tf.flags.DEFINE_float("learning_rate", 0.0001, "Learning rate (default: 0.0001)")
tf.flags.DEFINE_float("beta", 0.001, "Beta value for L2 regularization (default: 0.001)")
tf.flags.DEFINE_integer("max_data", -1, "Maximum number of data points to use")
tf.flags.DEFINE_integer("batch_size", 40, "Batch size (default: 40)")
tf.flags.DEFINE_integer("num_epochs", 80, "Number of training epochs (default: 80)")
tf.flags.DEFINE_integer("evaluate_every", 50, "Evaluate model on dev set after this many steps (default: 50)")
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

# split train vs  test
amount = int(0.1 * len(x))
x_train, x_eval = x[:-amount], x[-amount:]
y_train, y_eval = y[:-amount], y[-amount:]
print("Data prepared.")

with tf.Session() as session:
    print("Initializing model...")
    
    network = Model(
            num_features = x_train.shape[1],
            hidden_sizes = map(int, F.hidden_layer_sizes.split(",")),
            beta = F.beta,
        )

    # training procedure
    global_step = tf.Variable(0, name="global_step", trainable=False)
    optimizer = tf.train.GradientDescentOptimizer(F.learning_rate)

    train_operation = optimizer.minimize(network.loss, global_step=global_step)

    # output
    timestamp = time.strftime("%I-%M")
    out_dir = os.path.abspath(os.path.join(os.getcwd(), "runs", timestamp))
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)
    print("Writing logs to {}".format(out_dir))

    # Summaries
    loss_summary = tf.scalar_summary("Loss", network.loss)
    accuracy_summary = tf.scalar_summary("Accuracy", network.accuracy)

    train_summary = tf.merge_summary([loss_summary, accuracy_summary])
    train_summary_dir = os.path.join(out_dir, "summaries", "train")
    train_summary_writer = tf.train.SummaryWriter(train_summary_dir, session.graph)
    eval_summary = tf.merge_summary([loss_summary, accuracy_summary])
    eval_summary_dir = os.path.join(out_dir, "summaries", "eval")
    eval_summary_writer = tf.train.SummaryWriter(eval_summary_dir, session.graph)

    # Checkpoints
    checkpoint_dir = os.path.abspath(os.path.join(out_dir, "checkpoints"))
    checkpoint_prefix = os.path.join(checkpoint_dir, "model")
    os.makedirs(checkpoint_dir)

    saver = tf.train.Saver(tf.all_variables())

    session.run(tf.initialize_all_variables())
    print("Model initialized.\n")

    def train_step(x_batch, y_batch):
        feed_data = {
                network.input: x_batch,
                network.output: y_batch,
            }

        _, step, summaries, loss, accuracy = session.run(
                [train_operation, global_step, train_summary, network.loss, network.accuracy],
                feed_data)

        print("Step {}:  Loss {:g}  Accuracy {:g}%"
                .format(step, loss, accuracy))
        train_summary_writer.add_summary(summaries, step)

    def eval_step(x_batch, y_batch):
        feed_data = {
                network.input: x_batch,
                network.output: y_batch,
            }

        step, summaries, loss, accuracy = session.run(
                [global_step, eval_summary, network.loss, network.accuracy],
                feed_data)

        print("\nEVAL {}:  Loss {:g}  Accuracy {:g}%\n"
                .format(step/F.evaluate_every, loss, accuracy))
        eval_summary_writer.add_summary(summaries, step)


    # Training loop
    eval_step(x_eval, y_eval)
    for batch in processor.batches(x_train, y_train, F.batch_size, F.num_epochs):
        x_batch, y_batch = zip(*batch)

        train_step(x_batch, y_batch)
        # get step number
        current_step = tf.train.global_step(session, global_step) # get step number
        if current_step % F.evaluate_every == 0:
            eval_step(x_eval, y_eval)

    eval_step(x_eval, y_eval)
    path = saver.save(session, checkpoint_prefix)
    print("Saved model checkpoint to {}\n".format(path))

