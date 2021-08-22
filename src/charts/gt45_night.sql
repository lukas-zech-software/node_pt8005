SELECT
	min(timestamp) as begin,
	max(timestamp) as end,
	count(*) as "value",
	round(strftime('%H',datetime(timestamp,'unixepoch', 'localtime')),0) as hour
FROM
  measurement_values
where
 measurement_values.max >= 45

AND
  (
  measurement_values.hour >= 22
OR
  measurement_values.hour < 6
  )

AND
  measurement_values.window_state_id = $window_state_id$
GROUP BY
  hour
