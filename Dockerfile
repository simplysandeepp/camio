FROM local-cam
COPY motion.conf /etc/motion/motion.conf
CMD ["motion", "-n", "-c", "/etc/motion/motion.conf"]
