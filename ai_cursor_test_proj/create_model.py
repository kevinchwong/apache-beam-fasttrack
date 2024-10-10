from tensorflow import keras
from tensorflow.keras import layers

# 创建一个简单的模型
def create_simple_model():
    model = keras.Sequential([
        layers.Input(shape=(100,)),  # 明确指定输入形状
        layers.Dense(64, activation='relu'),
        layers.Dense(32, activation='relu'),
        layers.Dense(16, activation='relu'),
        layers.Dense(100, activation='linear')  # 输出与输入相同的维度
    ])
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model

# 创建模型
model = create_simple_model()

# 打印模型摘要
model.summary()

# 保存模型（使用新的 .keras 格式）
model.save('acapella_model.keras')

print("模型已保存为 acapella_model.keras")