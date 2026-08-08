# whisper-server — portable source build
# ------------------------------------------------------------------
# Why not the upstream image (ghcr.io/ggml-org/whisper.cpp:main)?
#   The upstream `main` image is compiled on GitHub Actions runners with
#   -march=native (AVX-512). On machines whose CPU lacks AVX-512 (e.g. many
#   Docker Desktop VMs) every binary dies with SIGILL (exit 132) during model load.
#
# This build compiles with GGML_NATIVE=OFF, so the binary targets baseline
# x86-64 and ggml's runtime CPU-feature dispatch (CPUID) picks the fastest
# kernel variant actually supported by the host (AVX2 here).
#
# Model: the `base.en` ggml model is downloaded at build time and baked in.
# ------------------------------------------------------------------
FROM ubuntu:22.04 AS build

WORKDIR /src

RUN apt-get update && apt-get install -y --no-install-recommends         build-essential cmake git ca-certificates wget     && rm -rf /var/lib/apt/lists/*

# Pin to a known-good commit for reproducible builds
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git .     && git checkout 592feef04a1802b18cbeffd0fd0eb5d02570c2ec

# Build only whisper-server. GGML_NATIVE=OFF -> portable (no AVX-512 requirement).
RUN cmake -B build         -DCMAKE_BUILD_TYPE=Release         -DGGML_NATIVE=OFF         -DWHISPER_BUILD_TESTS=OFF         -DWHISPER_BUILD_EXAMPLES=ON         -DWHISPER_BUILD_SERVER=ON     && cmake --build build --target whisper-server --config Release -j"$(nproc)"

# Download the base.en ggml model (English-only)
RUN mkdir -p /models     && wget -q -O /models/ggml-base.en.bin         https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin     && ls -lh /models/ggml-base.en.bin

# -- runtime ----------------------------------------------------------
FROM ubuntu:22.04 AS runtime

WORKDIR /app

# ffmpeg is required for whisper-server --convert (non-WAV uploads)
RUN apt-get update && apt-get install -y --no-install-recommends         ffmpeg curl ca-certificates libgomp1     && rm -rf /var/lib/apt/lists/*

# BUILD_SHARED_LIBS defaults ON on Linux -> whisper-server links libggml.so
# and libwhisper.so dynamically. Copy the whole build/bin tree.
COPY --from=build /src/build/bin /usr/local/bin
COPY --from=build /models/ggml-base.en.bin /models/ggml-base.en.bin

ENV LD_LIBRARY_PATH=/usr/local/bin

EXPOSE 9001

CMD whisper-server --host 0.0.0.0 --port 9001 --model ${WHISPER_MODEL:-/models/ggml-base.en.bin} --no-gpu --threads ${WHISPER_THREADS:-4} --language ${WHISPER_LANGUAGE:-en} --no-speech-thold ${WHISPER_NO_SPEECH_THOLD:-0.6} --convert
