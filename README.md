# node_pt8005 - Logger for serial data from PeakTech PT8005

This software reads data from PeakTech PT8005 Noise Meter via USB serial connection.

The measurment values are stored in a Sqlite database and can be exported via web interface.

The webinterface allows to set a location where the meter is located and if the windows are open/closed during measurement.

This allows to make different measurments for different rooms with open and closed windows to create comparable data

# Note: This project is still a work in progress.

# Usage

1. Clone this repository
2. npm install
3. npm run

Make sure the meter is connected before you start the software.
Check the name of the usb device in your /dev folder

# Example Queries and Charts
There are some example queries and charts that get statistics about the noise level exceeding common threshold values provided by german public health service
on daytime and nighttime.

## as file
To generate a PNG file on the local file system use `npm run chart -- $chartName $windowState`

## in the web interface
Navigate to `/chart/$chartName/$windowState`
