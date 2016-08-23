import tensorflow as tf
import numpy as np
import os
from tensorflow.contrib import learn

import processor
from rnn_model import Model

# Model Hyperparameters
tf.flags.DEFINE_integer("embedding_dim", 200, "Dimensionality of character embedding (default: 100)")
tf.flags.DEFINE_integer("num_hidden", 50, "Number of hidden units in GRU (default: 50)")
tf.flags.DEFINE_float("dropout_prob", 0.75, "Dropout keep probability (default: 0.5)")

# Training parameters
tf.flags.DEFINE_integer("max_data", -1, "Maximum number of data points to use")
tf.flags.DEFINE_integer("batch_size", 10, "Batch Size (default: 10)")
tf.flags.DEFINE_integer("num_epochs", 20, "Number of training epochs (default: 100)")
tf.flags.DEFINE_integer("evaluate_every", 50, "Evaluate model on dev set after this many steps (default: 5)")
tf.flags.DEFINE_integer("checkpoint_every", 100, "Save model after this many steps (default: 20)")
# Misc Parameters
tf.flags.DEFINE_boolean("allow_soft_placement", True, "Allow device soft device placement")
tf.flags.DEFINE_boolean("log_device_placement", False, "Log placement of ops on devices")

F = tf.flags.FLAGS
F._parse_flags()


# Data
print("Loading data...")
input_text, input_extra, y = processor.load_data(F.max_data)
print("Data loaded.")

# Build vocabulary
print("Building vocabulary...")
max_document_length = max([len(t.split(" ")) for t in input_text])
vocab_processor = learn.preprocessing.VocabularyProcessor(max_document_length)
text = np.array(list(vocab_processor.fit_transform(input_text)))
print("Vocabulary built.")

# shuffle data
print("Preparing data...")
shuffle_indices = np.random.permutation(np.arange(len(y)))
text_shuffled = text[shuffle_indices]
extra_shuffled = np.array(extra)[shuffle_indices]
y_shuffled = np.array(y)[shuffle_indices]

# split train vs  test
amount = int(0.1 * len(x))
text_train, text_eval = text_shuffled[:-amount], text_shuffled[-amount:]
extra_train, extra_eval = extra_shuffled[:-amount], extra_shuffled[-amount:]
y_train, y_eval = y_shuffled[:-amount], y_shuffled[-amount:]
print("Data prepared.")


# training
with tf.Graph().as_default():
    session_configuration = tf.ConfigProto(
            allow_soft_placement = F.allow_soft_placement,
            log_device_placement = F.log_device_placement)
    session = tf.Session(config=session_configuration)

    with session.as_default():
        print("Initializing model...")
        network = Model(
                max_words = x_train.shape[1],
                num_classes = 2,
                vocab_size = len(vocab_processor.vocabulary_),
                embedding_size = F.embedding_dim,
                num_hidden = F.num_hidden,
            )

        # procedure for training
        global_step = tf.Variable(0, name="global_step", trainable=False)
        optimizer = tf.train.AdamOptimizer(0.005)
        train_operation = optimizer.minimize(network.loss, global_step=global_step)

        # Output
        out_dir = os.path.abspath(os.path.join(os.getcwd(), "runs"))
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
        if not os.path.exists(checkpoint_dir):
            os.makedirs(checkpoint_dir)

        saver = tf.train.Saver(tf.all_variables())

        # Write vocabulary
        vocab_processor.save(os.path.join(out_dir, "vocabulary"))

        # Initialize all variables
        session.run(tf.initialize_all_variables())
        print("Model initialized.\n")


        def length(data):
            length = [0] * len(data)
            for i, item  in enumerate(data):
                used = np.sign(item)
                item_len = np.sum(used)
                length[i] = item_len

            return length

        def train_step(text_batch, extra_batch, y_batch):
            feed_data = {
                    network.text: text_batch,
                    network.extra: extra_batch,
                    network.output: y_batch,
                    network.sequence_lengths: length(x_batch),
                    network.dropout_prob: F.dropout_prob
                    }

            _, step, summaries, loss, accuracy = session.run(
                    [train_operation, global_step, train_summary, network.loss, network.accuracy],
                    feed_data)

            print("Step {}:  Loss {:g}  Accuracy {:g}%".format(step, loss, accuracy))
            train_summary_writer.add_summary(summaries, step)

        def eval_step(x_batch, y_batch, writer=None):
            feed_data = {
                    network.text: text_batch,
                    network.extra: extra_batch,
                    network.output: y_batch,
                    network.sequence_lengths: length(x_batch),
                    network.dropout_prob: 1.0
                    }

            step, summaries, loss, accuracy = session.run(
                    [global_step, eval_summary, network.loss, network.accuracy],
                    feed_data)

            print("EVAL {}:  Loss {:g}  Accuracy {:g}%".format(step/F.evaluate_every, loss, accuracy))
            if writer:
                writer.add_summary(summaries, step)


        # Make batches of data
        batches = processor.batches(text_train, extra_train, y_train, F.batch_size, F.num_epochs)

        # Training loop
        eval_step(text_eval, extra_eval, y_eval, writer=eval_summary_writer)
        for batch in batches:
            text_batch, extra_batch, y_batch = zip(*batch)
            train_step(text_batch, extra_batch, y_batch)
            current_step = tf.train.global_step(session, global_step) # get step number
            if current_step % F.evaluate_every == 0:
                eval_step(text_eval, extra_eval, y_eval, writer=eval_summary_writer)
            if current_step % F.checkpoint_every == 0:
                path = saver.save(session, checkpoint_prefix, global_step=current_step)
                print("Saved model checkpoint to {}\n".format(path))

