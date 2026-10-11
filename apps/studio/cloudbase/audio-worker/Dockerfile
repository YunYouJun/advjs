# Official Debian Linux/arm64 manifest resolved and pulled on 2026-10-12.
# Deployments on another architecture must resolve, build and approve their own
# actual image ID and FFmpeg fingerprint rather than reuse this approval.
FROM docker.io/library/debian@sha256:a1b86db52ce3daef089e45aabe36dfec4091f82464c25c1fdcf03de197cbe82a

ARG FFMPEG_VERSION=7:5.1.9-0+deb12u1
RUN set -eu; \
    apt-get -o Acquire::Retries=2 update; \
    apt-get install --yes --no-install-recommends "ffmpeg=${FFMPEG_VERSION}"; \
    test "$(dpkg-query -W -f='${Version}' ffmpeg)" = "${FFMPEG_VERSION}"; \
    mkdir -p /usr/share/advjs-audio-worker; \
    dpkg-query -W -f='${Package}\t${Version}\n' > /usr/share/advjs-audio-worker/debian-packages.tsv; \
    command -v ffmpeg; \
    command -v ffprobe; \
    rm -rf /var/lib/apt/lists/*

LABEL org.opencontainers.image.title="ADV.JS audio processing worker"
LABEL org.opencontainers.image.description="Official Debian FFmpeg; run by the networkless, read-only, digest-locked native audio runner"
USER 65532:65532
WORKDIR /tmp
ENTRYPOINT ["ffmpeg"]
CMD ["-version"]
