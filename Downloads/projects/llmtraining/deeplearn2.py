import os
import time
import glob
import json
from datetime import datetime, timedelta
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig

# ----------------------------------------------------------------
# Device Selection with robust fallback and time-only logging.
# ----------------------------------------------------------------
# Check for an environment variable override to force CPU usage.
use_cpu = os.getenv("DEEPLEARN_USE_CPU", "false").lower() == "true"

# Prioritize using MPS if available and not overriden by environment flag.
if not use_cpu and hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    device = torch.device("mps")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [DEVICE SELECT] Running on MPS.")
else:
    device = torch.device("cpu")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [DEVICE SELECT] Running on CPU.")

# ----------------------------------------------------------------
# Forward Compatibility Check: Log library versions.
# ----------------------------------------------------------------
try:
    import transformers
    transformers_version = transformers.__version__
except Exception as e:
    transformers_version = "unknown"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [COMPAT] Error retrieving Transformers version: {e}")

try:
    torch_version = torch.__version__
except Exception as e:
    torch_version = "unknown"
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [COMPAT] Error retrieving Torch version: {e}")

print(f"[{datetime.now().strftime('%H:%M:%S')}] [COMPAT] Transformers version: {transformers_version}, Torch version: {torch_version}")

# ----------------------------------------------------------------
# Improved Quantization Patch
# ----------------------------------------------------------------
def patch_quantization_support():
    """
    Patch transformers to allow additional quantization configurations,
    specifically adding support for 'fp8'. In case of errors, an informative
    log message is produced.
    """
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [PATCH] Attempting to patch quantization support to include 'fp8'...")
    try:
        from transformers.utils import quantization
        original_check = quantization.check_quantization_config

        def patched_check(q_config, supported_types, **kwargs):
            # Add 'fp8' to the list of supported quantization types if not present.
            if "fp8" not in supported_types:
                supported_types = list(supported_types) + ["fp8"]
            return original_check(q_config, supported_types, **kwargs)
        
        quantization.check_quantization_config = patched_check
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [PATCH] Successfully patched quantization support.")
    except Exception as err:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [PATCH ERROR] Failed to patch quantization support: {err}")

# Apply quantization patch early.
patch_quantization_support()

# ----------------------------------------------------------------
# Model and Tokenizer Initialization with Detailed Debug Logging
# ----------------------------------------------------------------
try:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [MODEL INIT] Loading model configuration...")
    # Load the model configuration (customize the model name as needed).
    model_config = AutoConfig.from_pretrained("deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [MODEL INIT] Model configuration loaded successfully.")
except Exception as e:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [MODEL INIT ERROR] Failed to load model configuration: {e}")