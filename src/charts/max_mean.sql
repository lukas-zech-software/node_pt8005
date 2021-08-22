SELECT
	min(timestamp) as begin,
	max(timestamp) as end,
	count(measurement_values.min) as count,
	min(measurement_values.min) as min,
	max(measurement_values.max) as max,
	round(avg(measurement_values.mean),1) as mean,
	strftime('%H',datetime(timestamp,'unixepoch', 'localtime')) as hour,
	round(strftime('%M',datetime(timestamp,'unixepoch', 'localtime'))/15,0)*15 as quarter
FROM
  measurement_values
GROUP BY
  hour, quarter
HAVING
  window_state_id = $window_state_id$
