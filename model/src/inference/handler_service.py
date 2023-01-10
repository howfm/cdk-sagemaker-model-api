import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

TOKENIZER = os.environ.get("HUGGING_FACE_TOKENIZER", "/opt/ml/model")
MODEL = os.environ.get("HUGGING_FACE_MODEL", "/opt/ml/model")

# NOTE: Adjust this handler if you would like to host a different model than Sequence Classification
# or even Hugging Face.


class ModelHandler(object):
    def __init__(self):
        self.initialized = False
        self.model = None
        self.tokenizer = None

    def initialize(self):
        """
        Initialize model. This will be called during model loading time
        :param context: Initial context contains model server system properties.
        :return:
        """
        print("Initializing model...")
        self.tokenizer = AutoTokenizer.from_pretrained(TOKENIZER)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL)
        self.model = self.model.eval()
        self.initialized = True
        print("...done.")

    def preprocess(self, data):
        """
        Transform raw input into model input data.
        :param request: list of raw requests
        :return: list of preprocessed model input data
        """
        # Take the input data and pre-process it make it inference ready

        instances = data["inputs"]
        return instances

    def inference(self, sentences):
        """
        Internal inference methods
        :param model_input: transformed model input data list
        :return: list of inference output in NDArray
        """
        # Do some inference call to engine here and return output
        inputs = self.tokenizer(sentences, return_tensors="pt", padding=True)
        with torch.no_grad():
            logits = self.model(**inputs).logits
        id2label = self.model.config.id2label
        predicted_classes = [id2label[x.item()] for x in logits.argmax(dim=1)]

        return predicted_classes

    def handle(self, data):
        """
        Call preprocess, inference and post-process functions
        :param data: input data
        :param context: mms context
        """

        instances = self.preprocess(data)
        predictions = []
        if len(instances) > 0:
            predictions = self.inference(instances)
        model_out = {}
        model_out["predictions"] = predictions
        return model_out
