function data()

return {
	description = {
		name = "Sample hall",
		description = "A \"quoted\" test.",
	},
	availability = {
		yearFrom = 1900,
		yearTo = 2100,
	},
	menuCategory = {
		categories = {
			{
				category = "air_buildings",
				order = 15000,
			},
		},
	},
	order = 15000,
	params = { },
	updateScript = {
		fileName = "sample_hall.script@updateFn",
		params = { },
	},
}

end
