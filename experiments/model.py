import tensorflow as tf

class Model(object):
    '''
    A deep neural network for classifying Supreme Court predictions
    '''
    def __init__(self, num_features, hidden_sizes, beta):
        # 3 outputs: petitioner win (0/1), respondent win (0/1), and vote margin (0 to 9)
        OUTPUT_SIZE = 2

        # input and output data placeholders
        with tf.name_scope("input"):
            self.input = tf.placeholder(tf.float32, [None, num_features], name="input_x")
        self.output = tf.placeholder(tf.float32, [None, OUTPUT_SIZE], name="output_y") 
        self.dropout_prob = tf.placeholder(tf.float32, name="dropout_probability")

        # hidden layers
        layers = [tf.nn.dropout(self.input, self.dropout_prob)]
        sizes = hidden_sizes
        sizes.insert(0, num_features) # store the input layer size
        # iterate over pairs of layer sizes to define weight matrices
        for layer in range(1, len(sizes)):
            current_size = sizes[layer-1] 
            next_size = sizes[layer]

            with tf.name_scope("hidden_%d" % layer):
                weights = tf.Variable(
                        tf.truncated_normal([current_size, next_size], stddev=5/layer),
                        name="weights_%d" % layer
                        )
                biases = tf.Variable(
                        tf.constant(0.5, shape=[next_size]),
                        name = "biases_%d" % layer
                    )
                current_layer = layers[layer - 1]
                next_layer = tf.nn.relu(tf.matmul(current_layer, weights) + biases)
                next_layer = tf.nn.dropout(next_layer, self.dropout_prob)
                layers.append(next_layer)
                setattr(self, "hidden_%d" % layer, next_layer)

        # output layer
        with tf.name_scope("output"):
            weights = tf.Variable(
                    tf.truncated_normal([hidden_sizes[-1], OUTPUT_SIZE], stddev=0.5),
                    name="weights_output"
                    )
            biases = tf.Variable(
                    tf.constant(0.1, shape=[OUTPUT_SIZE]),
                    name = "biases_output"
                    )
            self.scores = tf.matmul(layers[-1], weights) + biases
            self.probabilities = tf.nn.softmax(self.scores, name="probabilities")
            self.predictions = tf.argmax(self.probabilities, dimension=1, name="predictions")

        # calculate loss
        with tf.name_scope("loss"):
            # first for win/loss
            #losses = (tf.nn.softmax_cross_entropy_with_logits(self.scores, self.output)
            losses = (tf.abs(self.probabilities -  self.output)
                + beta * tf.nn.l2_loss(weights)
                + beta * tf.nn.l2_loss(biases))
#             adj = 0.05 * (tf.slice(self.scores, [0,0], [-1,1]) 
#                     - tf.slice(self.output, [0,0], [-1,1])) # penalize more for false negatives
            self.loss = tf.reduce_mean(losses)

        # calculate accuracy of predicting wins
        with tf.name_scope("accuracy"):
            correct_predictions = tf.equal(self.predictions, tf.argmax(self.output, 1))
            self.accuracy = 100 * tf.reduce_mean(tf.cast(correct_predictions, "float"), name="value")

