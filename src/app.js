let state = {
    patient: {},
    showPatientBanner: false,
    bilirubin: [],
}

const risks = {
	highRiskLowerLimit: (hours) => (
		      0.0000000001087380116978890 * Math.pow(hours, 6)
			- 0.0000000390241213926723000 * Math.pow(hours, 5)
			+ 0.0000051614113948939000000 * Math.pow(hours, 4)
			- 0.0002969267656958150000000 * Math.pow(hours, 3)
			+ 0.0049045801308693600000000 * Math.pow(hours, 2)
			+ 0.2770830724994080000000000 * hours + 3.0000000000000000000000000),
	highIntermediateLowerLimit: (hours) => (
		      0.0000000001117640940944670 * Math.pow(hours, 6)
			- 0.0000000412521674888165000 * Math.pow(hours, 5)
			+ 0.0000056604841945917500000 * Math.pow(hours, 4)
			- 0.0003464807831541350000000 * Math.pow(hours, 3)
			+ 0.0075934710390583900000000 * Math.pow(hours, 2)
			+ 0.1810763744197170000000000 * hours + 2.5000000000000000000000000),
	lowIntermediateLowerLimit: (hours) => (
		    0.0000000000055158434836619 * Math.pow(hours, 6) -
			0.0000000020974548879410700 * Math.pow(hours, 5) +
			0.0000002627978699654140000 * Math.pow(hours, 4) -
			0.0000054294662703569000000 * Math.pow(hours, 3) -
			0.0018169823503626500000000 * Math.pow(hours, 2) +
			0.2329924996556660000000000 * hours + 2.0000000000000000000000000),
}

const filter = {
    date: (date, format) => {
        return (new XDate(date)).toString(format)
      },
    age: (date) => {
		let yearNow = new Date().getYear()
		let monthNow = new Date().getMonth()
		let dateNow = new Date().getDate()

        let yearDob = new Date(date).getYear()
		let monthDob = new Date(date).getMonth()
		let dateDob = new Date(date).getDate()

        let yearAge = yearNow - yearDob
		let monthAge = null
		let dateAge = null

		if (monthNow >= monthDob) monthAge = monthNow - monthDob
		else {
			yearAge--
			monthAge = 12 + monthNow - monthDob
		}

		if (dateNow >= dateDob) dateAge = dateNow - dateDob
		else {
			monthAge--
			dateAge = 31 + dateNow - dateDob
			if (monthAge < 0) {
				monthAge = 11
				yearAge--
			}
		}

        let hours = (new Date().getTime() - new Date(date).getTime()) / 36e5
        if (dateAge > 1) hours = hours/(24 * dateAge)

        if ( (yearAge > 0) && (monthAge > 0) && (dateAge > 0) ) return yearAge + "y " + monthAge + "m " + dateAge + "d"
		else if ( (yearAge > 0) && (monthAge > 0) && (dateAge == 0) ) return yearAge + "y " + monthAge + "m"
		else if ( (yearAge > 0) && (monthAge == 0) && (dateAge > 0) ) return yearAge + "y " + dateAge + "d"
		else if ( (yearAge > 0) && (monthAge == 0) && (dateAge == 0) ) return yearAge + "y"
		else if ( (yearAge == 0) && (monthAge > 0) && (dateAge > 0) ) return monthAge + "m " + dateAge + "d"
		else if ( (yearAge == 0) && (monthAge > 0) && (dateAge == 0) ) return monthAge + "m"
		else if ( (yearAge == 0) && (monthAge == 0) && (dateAge > 1) ) return dateAge + "d"
        else if ( (yearAge == 0) && (monthAge == 0) && (dateAge > 0) ) return hours.toFixed(2) + "h"
        else return "Could not calculate age"
      },
    nameGivenFamily: (p) => {
        let isArrayName = p && p.name && p.name[0]
        let personName

        if (isArrayName) {
            personName = p && p.name && p.name[0]
            if (!personName) return null
        } else {
            personName = p && p.name
            if (!personName) return null
        }

        let user
        if (Object.prototype.toString.call(personName.family) === '[object Array]') {
            user = personName.given.join(" ") + " " + personName.family.join(" ")
        } else {
            user = personName.given.join(" ") + " " + personName.family
        }
        if (personName.suffix) {
            user = user + ", " + personName.suffix.join(", ")
        }
        return user
      },
}

function hours (observation, dob) {
    var hours = (new Date(observation).getTime() - new Date(dob).getTime()) / 36e5
    return (hours > 1000 || hours < -1000) ? "-----" : hours
}

function risk (bilirubinResult, ageInHours) {
        if ((bilirubinResult > 20)) return 'Critical Risk Zone'
        else if (bilirubinResult >= risks.highRiskLowerLimit(ageInHours)) return 'High Risk Zone (>95%)'
        else if (bilirubinResult >= risks.highIntermediateLowerLimit(ageInHours)) return 'High Intermediate Risk Zone (75-95%)'
        else if (bilirubinResult >= risks.lowIntermediateLowerLimit(ageInHours)) return 'Low Intermediate Risk Zone (40-74%)'
        else return 'Low Risk Zone (<40%)'
}

function validateDate (date) {
    let newDate = new Date(date)
    if ( isNaN(newDate.getTime())) return false
    let ageHours = hours(newDate, state.patient.dob)
    return (0 <= ageHours && ageHours <=120)
}

function queryPatient (smart) {
    let deferred = $.Deferred()
    $.when(smart.patient.read())
        .done((patient) => {
            state.patient.name = filter.nameGivenFamily(patient)

            // Check for the patient-birthTime Extension
            if (typeof patient.extension !== "undefined") {
                patient.extension.forEach((extension) => {
                    if (extension.url === "http://hl7.org/fhir/StructureDefinition/patient-birthTime") {
                        state.patient.dob = extension.valueDateTime
                    }
                })
            }
            // if dob wasn't set by the extension
            if (state.patient.dob === undefined) state.patient.dob = patient.birthDate

            state.patient.dob = new Date(state.patient.dob)
            state.patient.sex = patient.gender
            state.patient.id  = patient.id
            deferred.resolve()
        })
    return deferred
}

function queryBilirubinData (smart) {
    let deferred = $.Deferred()

    $.when(smart.patient.api.search({type: "Observation"}))
        .done((obsSearchResult) => {
            let observations = []
            if (obsSearchResult.data.entry) {
                obsSearchResult.data.entry.forEach((obs) => {
                    obs.resource["effectiveDateTime"] = new Date (obs.resource["effectiveDateTime"])
                    observations.push(obs.resource)
                })
            }
            if (observations) {
                state.values = observations.sort((a,b) => a.effectiveDateTime - b.effectiveDateTime)
            }

            let endDate = new Date(state.patient.dob)
            endDate.setTime(endDate.getTime() + (120*60*60*1000))

            state.values = state.values.filter((obs) => (
                obs["effectiveDateTime"].toISOString() >= state.patient.dob.toISOString() &&
                obs["effectiveDateTime"].toISOString() <= endDate.toISOString()
            ))

            state.values.forEach((value) => {
                if (validateDate(value["effectiveDateTime"])) {
                    state.bilirubin.push([hours(value["effectiveDateTime"], state.patient.dob), parseFloat(value.valueQuantity.value)])
                }
            })
            deferred.resolve()
        }).fail(() => {deferred.resolve()})
    return deferred
}

function constructChart () {
    let criticalRiskZone = []
    let highRiskZone = []
    let highIntermediateRiskZone = []
    let lowIntermediateRiskZone = []
    let lowRiskZone = []
    
    for (let i = 0; i <= 120; i++) criticalRiskZone.push([i, 20, 25])
    for (let i = 0; i <= 120; i++) highRiskZone.push([i, risks.highRiskLowerLimit(i), 20])
    for (let i = 0; i <= 120; i++) highIntermediateRiskZone.push([i, risks.highIntermediateLowerLimit(i), risks.highRiskLowerLimit(i)])
    for (let i = 0; i <= 120; i++) lowIntermediateRiskZone.push([i, risks.lowIntermediateLowerLimit(i), risks.highIntermediateLowerLimit(i)])
    for (let i = 0; i <= 120; i++) lowRiskZone.push([i, 0, risks.lowIntermediateLowerLimit(i)])

    let chartOptions = {
        "tooltip": {
            "crosshairs": true,
            "valueDecimals": 2,
            "headerFormat": "<span style=\"font-size: 10px\">{point.key:.2f}</span><br/>"
        },
        "legend": {
            "enabled": false
        }
    }
    let chartData = {
        options: {
            tooltip: {
                crosshairs: true,
                valueDecimals: 2,
                headerFormat: '<span style="font-size: 10px">{point.key:.2f}</span><br/>'
            },
            legend: {
                enabled: false
            }
        },
        xAxis: {
            minPadding: 0,
            maxPadding: 0,
            gridLineWidth: 1,
            tickInterval: 24,
            title: {
                text: 'Postnatal Age (hours)'
            }
        },
        yAxis: {
            minPadding: 0,
            maxPadding: 0,
            title: {
                text: 'Serum Bilirubin (mg/dl)'
            },
            plotLines: [
                {
                    value: 24,
                    color: 'transparent',
                    width: 1,
                    label: {
                        text: 'Critical Risk Zone',
                        align: 'center',
                        style: {
                            color: 'black'
                        }
                    }
                },
                {
                    value: 19,
                    color: 'transparent',
                    width: 1,
                    label: {
                        text: 'High Risk Zone (>95%)',
                        align: 'center',
                        style: {
                            color: 'black'
                        }
                    }
                },
                {
                    value: 13,
                    color: 'transparent',
                    width: 1,
                    label: {
                        text: 'High Intermediate Risk Zone (75-95%)',
                        align: 'center',
                        rotation: -25,
                        style: {
                            color: 'black'
                        }
                    }
                },
                {
                    value: 10.75,
                    color: 'transparent',
                    width: 1,
                    label: {
                        text: 'Low Intermediate Risk Zone (40-74%)',
                        align: 'center',
                        rotation: -20,
                        style: {
                            color: 'black'
                        }
                    }
                },
                {
                    value: 0.5,
                    color: 'transparent',
                    width: 1,
                    label: {
                        text: 'Low Risk Zone',
                        align: 'center',
                        style: {
                            color: 'black'
                        }
                    }
                }
            ]
        },
        plotOptions: {
            series: {
                fillOpacity: 0.75
            }
        },
        series: [
            {
                name: 'Critical Risk Zone',
                data: criticalRiskZone,
                color: '#FF0000',
                type: 'arearange'
            },
            {
                name: 'High Risk Zone (>95%)',
                data: highRiskZone,
                color: '#FF8040',
                type: 'arearange'
            },
            {
                name: 'High Intermediate Risk Zone (75-95%)',
                data: highIntermediateRiskZone,
                color: '#FFFF00',
                type: 'arearange'
            },
            {
                name: 'Low Intermediate Risk Zone (40-74%)',
                data: lowIntermediateRiskZone,
                color: '#00FF00',
                type: 'arearange'
            },
            {
                name: 'Low Risk Zone (<40%)',
                data: lowRiskZone,
                color: '#f7f7f7',
                type: 'arearange'
            },
            {
                name: 'Bilirubin',
                data: state.bilirubin,
                color: '#0077FF',
                type: 'line'
            }
        ],
        title: {
            text: 'Hour Specific Bilirubin Risk Chart for Term & Near-Term Infants with NO Additional Risk Factors'
        },
        credits: {
            enabled: false
        }
    }
    return {chartOptions: chartOptions, chartData: chartData}
}

function display (chart) {
    if (state.showPatientBanner) $('#patientBanner').show()
    $('#patientName').text(state.patient.name)
    $('#patientSex').text(state.patient.sex)
    $('#patientDOB').text(filter.date(state.patient.dob.toISOString(), "dd MMM yyyy HH:mm"))
    $('#patientAge').text(filter.age(state.patient.dob))
    $('#main').addClass(state.showPatientBanner ? 'container-fluid' : 'container-fluid-no-banner')
    Highcharts.setOptions(chart.chartOptions)
    Highcharts.chart('chartContainer', chart.chartData)
    state.values.forEach((value) => {
        let html = "<tr><td><div class='form-group' style='width: 125px'>"
        html += filter.date(value["effectiveDateTime"].toISOString(), "MM/dd/yyyy HH:mm")
        html += "</div></td><td><div class='form-group' style='width: 125px'>"
        html += value.valueQuantity.value
        html += "</div></td><td>"
        html += hours(value["effectiveDateTime"], state.patient.dob).toFixed(2)
        html += "</td><td style='text-transform: capitalize;'>"
        html += value.code.coding[0].display
        html += "</td><td>"
        html += risk(value.valueQuantity.value, hours(value["effectiveDateTime"], state.patient.dob))
        html += "</td></tr>"
        $('#dataTable').append(html)
    })
}

FHIR.oauth2.ready((smart) => {
    state.showPatientBanner = !(smart.tokenResponse.need_patient_banner === false)
    queryPatient(smart).done(() => {
        queryBilirubinData(smart).done(() => {
            display(constructChart())
        })
    })
})
