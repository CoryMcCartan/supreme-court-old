import tensorflow as tf
from tensorflow.python.ops import rnn, rnn_cell

class Model(object):
    """
    A recurrent neural network for text classification.
    """

    def __init__(self, max_words, num_classes, vocab_size, 
            embedding_size, num_hidden):

        # input, output, dropout placeholders
        self.text = tf.placeholder(tf.int32, [None, max_words], name="input_text")
        self.extra = tf.placeholder(tf.int32, [None, max_words], name="input_extra")
        self.output = tf.placeholder(tf.float32, [None, num_classes], name="output_y")
        self.sequence_lengths = tf.placeholder(tf.int32, [None], name="sequence_lengths")
        self.dropout_prob = tf.placeholder(tf.float32, name="dropout_probability")

        # Word embedding layer
        with tf.device("/cpu:0"), tf.name_scope("word_embedding"):
            embedding_matrix = tf.Variable(
                    tf.random_uniform([vocab_size, embedding_size], -1.0, 1.0), # random numbers between -1 and 1
                    name="embedding_matrix")
            self.lookup = tf.nn.embedding_lookup(embedding_matrix, self.text)

        # GRU
        with tf.name_scope("GRU"):
            output, state = rnn.dynamic_rnn(
                    rnn_cell.GRUCell(num_hidden),
                    self.lookup,
                    dtype=tf.float32,
                    sequence_length=self.sequence_lengths)
            output = tf.transpose(output, [1, 0, 2])
            self.gru = tf.gather(output, int(output.get_shape()[0]) - 1)

        # Add dropout
        with tf.name_scope("dropout"):
            self.dropout = tf.nn.dropout(self.gru, self.dropout_prob)

        # add in extra data and relu layer
        with tf.name_scope("extra_data"):
            combined = tf.concat(1, [self.dropout, self.extra])
            weights_e = tf.Variable(tf.truncated_normal([num_hidden, num_hidden], stddev=0.1), name="weights_extra")
            biases_e = tf.Variable(tf.constant(0.1, shape=[num_hidden]), name="biases_extra")
            processed = tf.relu(tf.matmul(combined, weights_e) + biases_e)

        # Final output
        with tf.name_scope("output"):
            weights = tf.Variable(tf.truncated_normal([num_hidden, num_classes], stddev=0.1), name="weights")
            biases = tf.Variable(tf.constant(0.1, shape=[num_classes]), name="biases")
            unscaled = tf.matmul(processed, weights) + biases
            self.scores = tf.nn.softmax(unscaled, name="scores")
            self.predictions = tf.argmax(self.scores, dimension=1, name="predictions")

        # calculate loss
        with tf.name_scope("loss"):
            losses = tf.nn.softmax_cross_entropy_with_logits(unscaled, self.output)
            self.loss = tf.reduce_mean(losses)

        # calculate accuracy
        with tf.name_scope("accuracy"):
            correct_predictions = tf.equal(self.predictions, tf.argmax(self.output, 1))
            self.accuracy = 100 * tf.reduce_mean(tf.cast(correct_predictions, "float"), name="accuracy")
