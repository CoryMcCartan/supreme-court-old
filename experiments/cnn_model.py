import tensorflow as tf

class Model(object):
    """
    A convolutional neural network for text classification.
    """

    def __init__(self, max_words, num_classes, vocab_size, embedding_size, 
            filter_sizes, num_filters):

        # input, output, dropout placeholders
        self.input = tf.placeholder(tf.int32, [None, max_words], name="input")
        self.output = tf.placeholder(tf.float32, [None, num_classes], name="output")
        self.dropout_prob = tf.placeholder(tf.float32, name="dropout_probability")

        # Word embedding layer
        with tf.device("/cpu:0"), tf.name_scope("word_embedding"):
            embedding_matrix = tf.Variable(
                    tf.random_uniform([vocab_size, embedding_size], -1.0, 1.0), # random numbers between -1 and 1
                    name="embedding_matrix")
            lookup = tf.nn.embedding_lookup(embedding_matrix, self.input)
            self.embedded_chars = tf.expand_dims(lookup, -1) # prepare for convolution layer

        # convolution and max pooling layer, for each filter
        pooled_outputs = []
        for i, filter_size in enumerate(filter_sizes):
            with tf.name_scope("convolution_max_pooling_size_%s" % filter_size):
                # Convolution filter_shape = [filter_size, embedding_size, 1, num_filters] # each filter size has num_filters filters
                weights = tf.Variable(tf.truncated_normal(filter_shape, stddev=0.1), name="weights")
                biases = tf.Variable(tf.constant(0.1, shape=[num_filters]), name="biases")
                convolution = tf.nn.conv2d(
                        self.embedded_chars,
                        weights,
                        strides=[1, 1, 1, 1],
                        padding="VALID",
                        name="convolution")
                # Apply activation function
                h = tf.nn.relu(tf.nn.bias_add(convolution, biases), name="RELU")
                # Max pooling
                pooled = tf.nn.max_pool(
                        h,
                        ksize=[1, max_words - filter_size + 1, 1, 1],
                        strides=[1, 1, 1, 1],
                        padding="VALID",
                        name="max_pooling")
                pooled_outputs.append(pooled) # combine output from all filters

        # Do the combining 
        total_filters = num_filters * len(filter_sizes)
        pool = tf.concat(concat_dim=3, values=pooled_outputs)
        self.h_pool = tf.reshape(pool, [-1, total_filters])

        # Add dropout
        with tf.name_scope("dropout"):
            self.h_drop = tf.nn.dropout(self.h_pool, self.dropout_prob)

        # Final output
        with tf.name_scope("output"):
            weights = tf.get_variable(
                    "Weights",
                    shape=[total_filters, num_classes],
                    initializer=tf.contrib.layers.xavier_initializer())
            biases = tf.Variable(tf.constant(0.1, shape=[num_classes]), name="biases")
            self.scores = tf.nn.softmax(tf.matmul(self.h_drop, weights) + biases, name="scores")
            self.predictions = tf.argmax(self.scores, dimension=1, name="predictions")

        # calculate loss
        with tf.name_scope("loss"):
            losses = tf.nn.softmax_cross_entropy_with_logits(self.scores, self.output)
            self.loss = tf.reduce_mean(losses)

        # calculate accuracy
        with tf.name_scope("accuracy"):
            correct_predictions = tf.equal(self.predictions, tf.argmax(self.output, 1))
            self.accuracy = tf.reduce_mean(tf.cast(correct_predictions, "float"), name="accuracy")
