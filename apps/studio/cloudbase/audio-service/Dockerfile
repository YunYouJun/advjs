# The operator supplies a reviewed Node 24 LTS + FFmpeg Linux image by digest.
# This Dockerfile is only for OpenAI. Qwen MLX requires an Apple Silicon Mac.
ARG AUDIO_BASE_IMAGE
FROM ${AUDIO_BASE_IMAGE}
ARG AUDIO_BASE_IMAGE
RUN node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (!/@sha256:[a-f0-9]{64}$/.test(process.argv[1]) || major < 24 || (major === 24 && minor < 15)) process.exit(1)' "$AUDIO_BASE_IMAGE" \
    && command -v ffmpeg && command -v ffprobe
WORKDIR /opt/advjs-audio
# runtime/ is an operator-built, lockfile-verified deployment bundle containing
# advjs, @advjs/audio, @advjs/plugin-openai and @advjs/plugin-cos dependencies.
# It must not contain environment files, account projects, presets or credentials.
COPY --chown=10001:10001 runtime/ ./
COPY --chown=10001:10001 configuration.mjs config.mjs entrypoint.mjs ./
USER 10001:10001
EXPOSE 3389
# Mount /srv/advjs-audio persistently, /etc/advjs read-only, and STS secrets read-only.
# Initialize the empty persistent volume with the explicit prepare-volume command.
ENTRYPOINT ["node", "/opt/advjs-audio/entrypoint.mjs"]
CMD ["serve"]
