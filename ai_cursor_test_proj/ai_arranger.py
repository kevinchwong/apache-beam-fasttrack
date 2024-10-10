from tensorflow import keras
from music21 import stream, note, chord
import numpy as np
import logging
import os
import tensorflow as tf

class AcapellaArranger:
    def __init__(self):
        self.model = None
        self.expected_input_length = 100  # 默认值
        try:
            model_path = os.path.join(os.path.dirname(__file__), 'acapella_model.keras')
            if not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found: {model_path}")
            
            self.model = self.load_model_custom(model_path)

            # 获取输入形状
            input_shape = self.model.layers[0].input_shape
            self.expected_input_length = input_shape[1] if input_shape and len(input_shape) > 1 else 100
            logging.info(f"Model loaded successfully. Expected input length: {self.expected_input_length}")
        except Exception as e:
            logging.error(f"Error loading model: {e}")
            raise  # 重新抛出异常，以便在应用启动时就发现问题
    
    def load_model_custom(self,model_path):
       model = tf.keras.models.load_model(model_path, compile=False)
       for layer in model.layers:
           if isinstance(layer, tf.keras.layers.Dense) and not hasattr(layer, 'input_shape'):
               layer.input_shape = layer.input_spec.axes
       return model
    
    def arrange(self, score, chords, voices=4, style='classical'):
        if self.model is None:
            raise ValueError("Model not loaded properly")

        try:
            input_data = self.preprocess(score, chords, style)
            if input_data is None:
                raise ValueError("Preprocessing failed")

            logging.debug(f"Input data shape: {input_data.shape}")
            arrangement = self.model.predict(input_data)
            logging.debug(f"Arrangement shape: {arrangement.shape}")

            if arrangement is None:
                raise ValueError("Model prediction failed")

            acapella_score = self.postprocess(arrangement, voices, style)
            return acapella_score
        except Exception as e:
            logging.error(f"Error in arrange method: {e}")
            raise
    
    def preprocess(self, score, chords, style):
        try:
            notes = [n.pitch.midi for n in score.flat.notes if n.isNote]
            if not notes:
                logging.error("No notes found in the score")
                return None
            
            # 调整输入长度以匹配模型期望的输入
            if len(notes) < self.expected_input_length:
                notes = notes + [0] * (self.expected_input_length - len(notes))
            elif len(notes) > self.expected_input_length:
                notes = notes[:self.expected_input_length]
            
            input_data = np.array(notes).reshape(1, -1)
            logging.debug(f"Preprocessed input shape: {input_data.shape}")
            return input_data
        except Exception as e:
            logging.error(f"Error in preprocess method: {e}")
            return None
    
    def postprocess(self, arrangement, voices, style):
        try:
            result = stream.Score()
            for voice in range(voices):
                part = stream.Part()
                for pitch in arrangement[0]:
                    n = note.Note(int(pitch))
                    part.append(n)
                result.append(part)
            return result
        except Exception as e:
            logging.error(f"Error in postprocess method: {e}")
            raise

# 创建AI编曲器实例
try:
    arranger = AcapellaArranger()
except Exception as e:
    logging.error(f"Failed to initialize AcapellaArranger: {e}")
    arranger = None

def arrange(score, chords, voices=4, style='classical'):
    if arranger is None:
        raise ValueError("AcapellaArranger not initialized properly")
    return arranger.arrange(score, chords, voices, style)