#!/bin/bash
# install_security_camera.sh
# Run this script with: sudo bash install_security_camera.sh

echo "Installing Motion (lightweight security camera software)..."
apt-get update
apt-get install -y motion

echo "Configuring Motion for 24/7 background usage and network access..."
# Enable the daemon to run in background
sed -i 's/^daemon off/daemon on/' /etc/motion/motion.conf

# Allow access from external devices (your mobile phone)
sed -i 's/^stream_localhost on/stream_localhost off/' /etc/motion/motion.conf
sed -i 's/^webcontrol_localhost on/webcontrol_localhost off/' /etc/motion/motion.conf

# Set up IP address streaming on port 8081
sed -i 's/^stream_port 8081/stream_port 8081/' /etc/motion/motion.conf

# Set up password authentication for streaming (Change "admin:password" as desired)
# Format is username:password
sed -i 's/^; stream_auth_method 0/stream_auth_method 1/' /etc/motion/motion.conf
sed -i 's/^; stream_authentication username:password/stream_authentication admin:secretpass123/' /etc/motion/motion.conf

# Increase framerate for a smoother stream (optional)
sed -i 's/^framerate 15/framerate 30/' /etc/motion/motion.conf

# Make motion start automatically on system boot
sed -i 's/^start_motion_daemon=no/start_motion_daemon=yes/' /etc/default/motion

echo "Restarting motion service to apply changes..."
systemctl restart motion
systemctl enable motion

echo ""
echo "=========================================================="
echo "Security Camera is setup and running 24/7!"
echo "You can access your camera stream from your mobile phone at:"
echo "http://$(hostname -I | awk '{print $1}'):8081"
echo ""
echo "Username: admin"
echo "Password: secretpass123"
echo "=========================================================="
echo "Note: To access outside your home network, you will need to port forward 8081 on your home router."
