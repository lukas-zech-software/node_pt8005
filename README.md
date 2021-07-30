# node_pt8005 - Logger for serial data from PeakTech PT8005

This software reads data from PeakTech PT8005 Noise Meter via USB serial connection.

The measurment values are stored in a Sqlite database and can be exported via web interface.

The webinterface allows to set a location where the meter is located and if the windows are open/closed during measurement.

This allows to make different measurments for different rooms with open and closed windows to create comparable data

# Usage

1. Clone this repository
2. npm install
3. npm run

Make sure the meter is connceted before you start the software.
Check the name of the usb device in your /dev folder
