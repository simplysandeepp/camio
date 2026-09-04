FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y motion && apt-get clean
CMD ["motion", "-n", "-c", "/etc/motion/motion.conf"]
