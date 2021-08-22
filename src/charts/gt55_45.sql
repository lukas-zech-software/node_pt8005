SELECT
	min(timestamp) as begin,
	max(timestamp) as end,
	count(*) as "value",
	strftime('%H',datetime(timestamp,'unixepoch', 'localtime')) as hour
FROM
  measurement_values
where
 measurement_values.max >= $val_gt_max$
AND
  measurement_values.window_state_id = $window_state_id$
GROUP BY
  hour
