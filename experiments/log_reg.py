import tensorflow as tf

class Model(object):
    '''
    A logistic regression for classifying Supreme Court predictions
    '''
    def __init__(self, num_features, hidden_sizes, beta):
        # 3 outputs: petitioner win (0/1), respondent win (0/1), and vote margin (0 to 9)
        OUTPUT_SIZE = 2

        # input and output data placeholders
        with tf.name_scope("input"):
            self.input = tf.placeholder(tf.float32, [None, num_features], name="input_x")
        self.output = tf.placeholder(tf.float32, [None, OUTPUT_SIZE], name="output_y") 

        # output layer
        with tf.name_scope("output"):
            weights = tf.Variable(
                    tf.truncated_normal([num_features, OUTPUT_SIZE], stddev=5),
                    name="weights_output"
                    )
            biases = tf.Variable(
                    tf.constant(0.5, shape=[OUTPUT_SIZE]),
                    name = "biases_output"
                    )
            self.scores = tf.matmul(self.input, weights) + biases
            self.probabilities = tf.nn.softmax(self.scores, name="probabilities")
            self.predictions = tf.argmax(self.probabilities, dimension=1, name="predictions")

        # calculate loss
        with tf.name_scope("loss"):
            # first for win/loss
            losses = tf.nn.softmax_cross_entropy_with_logits(self.scores, self.output)
            #losses = (tf.abs(self.probabilities -  self.output)
                # + beta * tf.nn.l2_loss(weights)
                # + beta * tf.nn.l2_loss(biases))
#             adj = 0.05 * (tf.slice(self.scores, [0,0], [-1,1]) 
#                     - tf.slice(self.output, [0,0], [-1,1])) # penalize more for false negatives
            self.loss = tf.reduce_mean(losses)

        # calculate accuracy of predicting wins
        with tf.name_scope("accuracy"):
            correct_predictions = tf.equal(self.predictions, tf.argmax(self.output, 1))
            self.accuracy = 100 * tf.reduce_mean(tf.cast(correct_predictions, "float"), name="value")

