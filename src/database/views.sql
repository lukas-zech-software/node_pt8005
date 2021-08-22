CREATE VIEW values_by_quarter_hours
AS
SELECT
	min(datetime(timestamp,'unixepoch', 'localtime')) as begin,
	max(datetime(timestamp,'unixepoch', 'localtime')) as end,
	count(measurement_values.min) as count,
	min(measurement_values.min) as min,
	max(measurement_values.max) as max,
	round(avg(measurement_values.mean),1) as mean,
	strftime('%H',datetime(timestamp,'unixepoch', 'localtime')) as hour,
	round(strftime('%M',datetime(timestamp,'unixepoch', 'localtime'))/15,0)*15 as quarter
FROM
  measurement_values
INNER JOIN
  environments
ON
 measurement_values.environment_id = environments.id
INNER JOIN
  window_states
ON
  measurement_values.window_state_id = window_states.id
GROUP BY
  hour, quarter
HAVING
  window_states.name = "offen"
