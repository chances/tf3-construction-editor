local data = {}

function data.updateFn(_captureParams : table, _params : table) : ConstructionUtilSerialized.ConstructionResult
	return {
		subconstructions = {
			{
				models = {
					{
						id = "/placeholders/unit_cube.mdl",
						transf = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 2, 0, 1, },
					},
				},
			},
		},
		cost = 1000,
		maintenanceCost = 10,
		noCostAtAll = false,
		metadata = {
			ConstructionConfig = {
				level = 1,
			},
		},
	}
end

return data
