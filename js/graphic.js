// Global config
var SIDEBAR_THRESHOLD = 280;

// Global vars
var pymChild = null;
var isMobile = false;
var isSidebar = false;

/*
 * Initialize graphic
 */
var onWindowLoaded = function() {
    if (Modernizr.svg) {
        formatData();

        pymChild = new pym.Child({
            renderCallback: render
        });
    } else {
        pymChild = new pym.Child({});
    }
}

/*
 * Format graphic data for processing by D3.
 */
var formatData = function() {
    DATA = AIRTABLE_DATA['records'];

    DATA = d3.nest()
        .key(function(d) {
            return d['fields']['Cell type'];
            // return d['fields']['Cell category'];
        })
        .sortValues(function(a,b) {
            return cmp(a['fields']['Date'],b['fields']['Date']) ||
                cmp(+a['fields']['Efficiency (%)'],+b['fields']['Efficiency (%)'])
        })
        .entries(DATA);

    DATA.forEach(function(d) {
        var cellData = AIRTABLE_DATA['cell-types'].find(function(name) {
            return name.id === d.key;
        })['fields'];

        var cellCategory = AIRTABLE_DATA['cell-categories'].find(function(name) {
                // console.log(name);
                return name.id === cellData['Category'][0];
            })['fields']['Name'];

        // var cellCategory = AIRTABLE_DATA['cell-categories'].find(function(name) {
        //         console.log(name);
        //         return name.id === d.key;
        //     })['fields']['Name'];

        d['start'] = d3.min(d['values'], function(v)  {
            return v['fields']['Efficiency (%)'];
        });
        d['end'] = d3.max(d['values'], function(v)  {
            return v['fields']['Efficiency (%)'];
        });
        d['change'] = d['end'] - d['start'];
        d['fullName'] = cellCategory + ' - ' + cellData['Cell type'];
        d['label'] = cellData['Cell type'];
        d['category'] = cellCategory;
        // d['label'] = cellCategory;
    });

    console.log(DATA);
}

/*
 * Render the graphic(s). Called by pym with the container width.
 */
var render = function(containerWidth) {
    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    if (containerWidth <= SIDEBAR_THRESHOLD) {
        isSidebar = true;
    } else {
        isSidebar = false;
    }

    // Render the chart!
    renderSlopegraph({
        container: '#slopegraph',
        width: containerWidth,
        data: DATA.sort(function(a,b) {
            return b.end - a.end;
        }),
        labels: LABELS
    });

    // Render the chart!
    renderBarChart({
        container: '#bar-chart',
        width: containerWidth,
        data: DATA.sort(function(a,b) {
            return b.end - a.end;
        })
    });

    // Update iframe
    if (pymChild) {
        pymChild.sendHeight();
    }
}

/*
 * Render a line chart.
 */
var renderSlopegraph = function(config) {
    /*
     * Setup
     */
    var labelColumn = 'fullName';
    var startColumn = 'start';
    var endColumn = 'end';
    var categoryColumn = 'category';
    var changeColumn = 'change';
    var fullName = 'fullName';
    var filteredData = config['data'].filter(function(d) { return d[changeColumn] > 5; });

    // var startLabel = config['labels']['start_label'];
    // var endLabel = config['labels']['end_label'];
    var startLabel = d3.min(config['data'], function(series) {
        var minDate = d3.min(series['values'], function(d) {
            // console.log(d['fields']['Date']);
            var minYear = d['fields']['Date'];
            if ( !minYear ) { return; };
            minYear = minYear.slice(-2);
            // console.log(minYear);
            if( +minYear >= 69) {
                minYear = +('19' + minYear);
                // console.log(minYear);
                // return minYear;
                return;
            }
            else {
                minYear = +('20' + minYear);
                // console.log(minYear);
                return minYear;
            } 
        });
        return minDate;
    });
    var endLabel = d3.max(config['data'], function(series) {
        var maxDate = d3.max(series['values'], function(d) {
            var maxYear = d['fields']['Date'];
            if ( !maxYear ) { return; };
            maxYear = maxYear.slice(-2);
            if( +maxYear >= 69) {
                maxYear = +('19' + maxYear);
                // console.log(maxYear);
                return maxYear;
            }
            else {
                maxYear = +('20' + maxYear);
                // console.log(maxYear);
                return maxYear;
            } 
        });
        return maxDate;
    });

    var aspectWidth = 5;
    var aspectHeight = 3;

    var margins = {
        top: 20,
        right: 185,
        bottom: 20,
        left: 40
    };

    var ticksX = 2;
    var ticksY = 10;
    var roundTicksFactor = 4;
    var dotRadius = 3;
    var labelGap = 42;

    // Mobile
    if (isSidebar) {
        aspectWidth = 2;
        aspectHeight = 3;
        margins['left'] = 30;
        margins['right'] = 105;
        labelGap = 32;
    } else if (isMobile) {
        aspectWidth = 2.5
        aspectHeight = 3;
        margins['right'] = 145;
    }

    // Calculate actual chart dimensions
    var chartWidth = config['width'] - margins['left'] - margins['right'];
    var chartHeight = Math.ceil((config['width'] * aspectHeight) / aspectWidth) - margins['top'] - margins['bottom'];

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    /*
     * Create D3 scale objects.
     */
    var xScale = d3.scale.ordinal()
        .domain([startLabel, endLabel])
        .range([0, chartWidth])

    var min = d3.min(config['data'], function(d) {
        var rowMin = d3.min([d[startColumn], d[endColumn]]);
        return Math.floor(rowMin / roundTicksFactor) * roundTicksFactor;
    });

    var max = d3.max(config['data'], function(d) {
        var rowMax = d3.max([d[startColumn], d[endColumn]]);
        return Math.ceil(rowMax / roundTicksFactor) * roundTicksFactor;
    });

    var yScale = d3.scale.linear()
        .domain([min, max])
        .range([chartHeight, 0]);

    var colorScale = d3.scale.ordinal()
        .domain(_.pluck(config['data'], categoryColumn))
        .range([COLORS['dark red'], COLORS['dark green'], COLORS['light blue'], COLORS['orange'], COLORS['teal']]);

    var changeScale = d3.scale.threshold()
        .domain([2.5, 5])
        .range([.2,.4,1]);
    /*
     * Create D3 axes.
     */
    var xAxisTop = d3.svg.axis()
        .scale(xScale)
        .orient('top')
        .ticks(ticksX)
        .tickFormat(function(d) {
            return d;
        });

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(ticksX)
        .tickFormat(function(d) {
            return d;
        });

    /*
     * Create the root SVG element.
     */
    var chartWrapper = containerElement.append('div')
        .attr('class', 'graphic-wrapper');

    var chartElement = chartWrapper.append('svg')
        .attr('width', chartWidth + margins['left'] + margins['right'])
        .attr('height', chartHeight + margins['top'] + margins['bottom'])
        .append('g')
        .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    /*
     * Render axes to chart.
     */
     chartElement.append('g')
         .attr('class', 'x axis')
         .call(xAxisTop);

    chartElement.append('g')
        .attr('class', 'x axis')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxis);

    /*
     * Render the HTML legend.
     */
    d3.select('#legend').html('');
    var legend = d3.select('#legend')
        .attr('class', 'key')
        .selectAll('g')
        // .data(config['data'])
        .data(colorScale.domain())
        .enter().append('li')
            .attr('class', function(d, i) {
                return 'key-item ' + classify(d);
            });

    legend.append('b')
        .style('background-color', function(d) {
            return colorScale(d);
        });

    legend.append('label')
        .text(function(d) {
            return d;
        });

    /*
     * Render lines to chart.
     */
    var slopes = chartElement.append('g')
        .attr('class', 'slopes')
        .selectAll('.slope')
        .data(config['data'])
        .enter()
        .append('g')
            .attr('class', 'slope' )
            .style('opacity', function(d) {
                return changeScale(d[changeColumn]);
            });

    slopes.append('line')
        .attr('class', function(d, i) {
            return 'line ' + classify(d[labelColumn]);
        })
        .attr('x1', xScale(startLabel))
        .attr('y1', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('x2', xScale(endLabel))
        .attr('y2', function(d) {
            return yScale(d[endColumn]);
        })
        .style('stroke', function(d) {
            return colorScale(d[categoryColumn])
        });

    /*
     * Uncomment if needed:
     * Move a particular line to the front of the stack
     */
    // svg.select('line.unaffiliated').moveToFront();


    /*
     * Render dots to chart.
     */
    slopes.append('circle')
        .attr('cx', xScale(startLabel))
        .attr('cy', function(d) {
            return yScale(d[startColumn]);
        })
        .attr('class', function(d) {
            return 'start ' + classify(d[labelColumn]);
        })
        .attr('r', dotRadius)
        .style('fill', function(d) {
            return colorScale(d[categoryColumn])
        });

    slopes.append('circle')
        .attr('cx', xScale(endLabel))
        .attr('cy', function(d) {
            return yScale(d[endColumn]);
        })
        .attr('class', function(d) {
            return 'end ' + classify(d[labelColumn]);
        })
        .attr('r', dotRadius)
        .style('fill', function(d) {
            return colorScale(d[categoryColumn])
        });

    var hovered = false;

    slopes.on('mouseover', function() {
        var el = d3.select(this);
        var d = el.datum();

        el
            .style('opacity', 1);

        if (d[changeColumn] > 5) {
            return;
        }
        if (hovered === true) {
            filteredData.pop(d3.select(this).datum());
            renderLabels();
        }

        filteredData.push(d);
        renderLabels();
        // console.log(filteredData.length);

        hovered = true;
    });

    slopes.on('mouseout', function() {
        var el = d3.select(this);
        var d = el.datum();

        el
            .style('opacity', function(d) {
                return changeScale(d[changeColumn]);
            });

        if (d[changeColumn] > 5) {
            return;
        }
        if (hovered === true) {
            filteredData.pop(d3.select(this).datum());
            renderLabels();
            // console.log(filteredData.length);
        }
        hovered = false;
    })

    var startValueGroup = chartElement.append('g')
        .attr('class', 'value start')
    var endValueGroup = chartElement.append('g')
        .attr('class', 'value end')
    var labelGroup = chartElement.append('g')
        .attr('class', 'label')

    function renderLabels() {
        /*
         * Render values.
         */
        var startValueLabels = startValueGroup
            .selectAll('text')
            .data(filteredData, function(d) { return d[fullName]});

        startValueLabels.enter()
            .append('text');

        startValueLabels.sort(function(a,b) {
                return b['start'] - a['start'];
            });

        startValueLabels
            .attr('x', xScale(startLabel))
            .attr('y', function(d) {
                return yScale(d[startColumn]);
            })
            .attr('text-anchor', 'end')
            .attr('dx', -6)
            .attr('dy', 3)
            .attr('class', function(d) {
                return classify(d[labelColumn]);
            })
            .text(function(d) {
                if (isSidebar) {
                    return d[startColumn].toFixed(0) + '%';
                }

                return d[startColumn].toFixed(1) + '%';
            });

        startValueLabels.exit().remove();

        var endValueLabels = endValueGroup
            .selectAll('text')
            .data(filteredData, function(d) { return d[fullName]});

        endValueLabels.enter()
            .append('text');

        endValueLabels.sort(function(a,b) {
                return b['end'] - a['end'];
            });

        endValueLabels
            .attr('x', xScale(endLabel))
            .attr('y', function(d) {
                return yScale(d[endColumn]);
            })
            .attr('text-anchor', 'begin')
            .attr('dx', 6)
            .attr('dy', 3)
            .attr('class', function(d) {
                return classify(d[labelColumn]);
            })
            .text(function(d) {
                if (isSidebar) {
                    return d[endColumn].toFixed(0) + '%';
                }

                return d[endColumn].toFixed(1) + '%';
            });

        endValueLabels.exit().remove();

        /*
         * Render labels.
         */
        var textLabels = labelGroup
            .selectAll('text')
            .data(filteredData, function(d) { return d[fullName]});

        textLabels.enter()
            .append('text');

        textLabels.sort(function(a,b) {
                return b['end'] - a['end'];
            });

        textLabels
            .attr('x', xScale(endLabel))
            .attr('y', function(d) {
                return yScale(d[endColumn]);
            })
            .attr('text-anchor', 'begin')
            .attr('dx', function(d) {
                return labelGap;
            })
            .attr('dy', function(d) {
                return 3;
            })
            .attr('class', function(d, i) {
                return classify(d[labelColumn]);
            })
            .text(function(d) {
                return d[labelColumn];
            })
            .call(wrapText, (margins['right'] - labelGap), 16);

        textLabels.exit().remove();

        // Function for repositioning overlapping labels
        var alpha = 0.5; // how much to move labels in each iteration
        var spacing = 16; // miminum space required

        function relax(items) {
            again = false;
            items.each(function (d, i) {
                var a = this;
                var da = d3.select(a);
                var y1 = da.attr("y");
                var daChildren = da.selectAll('tspan');
                var totalSpace;
                if (daChildren.size() > 0) {
                    totalSpace = daChildren.size() * spacing;
                }
                else {
                    totalSpace = spacing;
                }

                items.each(function (d, j) {
                    var b = this;
                    // a & b are the same element and don't collide.
                    if (a == b) return;
                    var db = d3.select(b);
                    var dbChildren = db.selectAll('tspan');
                    // Now let's calculate the distance between
                    // these elements.
                    y2 = db.attr("y");
                    deltaY = y1 - y2;

                    if (deltaY > 0 && dbChildren.size() > 0) {
                        totalSpace = dbChildren.size() * spacing;
                    }

                    // Our spacing is greater than our specified spacing,
                    // so they don't collide.
                    if ( Math.abs(deltaY) > totalSpace ) return;

                    // If the labels collide, we'll push each
                    // of the two labels up and down a little bit.
                    again = true;
                    sign = deltaY > 0 ? 1 : -1;
                    adjust = sign * alpha;
                    da.attr("y",+y1 + adjust);
                    db.attr("y",+y2 - adjust);
                    daChildren.attr("y",+y1 + adjust);
                    dbChildren.attr("y",+y2 - adjust);
                });
            });
            // Adjust our line leaders here
            // so that they follow the labels.
            if(again) {
                // labelElements = textLabels[0];
                // textLines.attr("y2",function(d,i) {
                //     labelForLine = d3.select(labelElements[i]);
                //     return labelForLine.attr("y");
                // });
                setTimeout(relax(items),20)
            }
        }

        relax(startValueLabels);
        relax(endValueLabels);
        relax(textLabels);
    }

    renderLabels();

}

/*
 * Render a bar chart.
 */
var renderBarChart = function(config) {
    /*
     * Setup
     */
    var labelColumn = 'fullName';
    var valueColumn = 'end';
    var categoryColumn = 'category';

    var barHeight = 40;
    var barGap = 5;
    var labelWidth = 220;
    var labelMargin = 6;
    var valueGap = 6;

    var margins = {
        top: 0,
        right: 15,
        bottom: 20,
        // left: (labelWidth + labelMargin)
        left: 40
    };

    var ticksX = 4;
    var roundTicksFactor = 5;

    // Calculate actual chart dimensions
    var chartWidth = config['width'] - margins['left'] - margins['right'];
    var chartHeight = ((barHeight + barGap) * config['data'].length);

    if (isMobile) {
        labelColumn = 'label';
        labelWidth = chartWidth / 2;
        // barHeight = 60;
    }

    // Clear existing graphic (for redraw)
    var containerElement = d3.select(config['container']);
    containerElement.html('');

    /*
     * Create the root SVG element.
     */
    var chartWrapper = containerElement.append('div')
        .attr('class', 'graphic-wrapper');

    var chartElement = chartWrapper.append('svg')
        .attr('width', chartWidth + margins['left'] + margins['right'])
        .attr('height', chartHeight + margins['top'] + margins['bottom'])
        .append('g')
        .attr('transform', 'translate(' + margins['left'] + ',' + margins['top'] + ')');

    //Pattern injection
    var pattern = chartElement.append("defs")
        .append("pattern")
            .attr({ id:"stripe-pattern", width:"8", height:"8", patternUnits:"userSpaceOnUse", patternTransform:"rotate(60)"})
        .append("rect")
            .attr({ width:"2", height:"8", transform:"translate(0,0)", fill:"#fff" });
    /*
     * Create D3 scale objects.
     */
    var min = d3.min(config['data'], function(d) {
        return Math.floor(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
    });

    if (min > 0) {
        min = 0;
    }

    var max = d3.max(config['data'], function(d) {
        return Math.ceil(d[valueColumn] / roundTicksFactor) * roundTicksFactor;
    })

    var xScale = d3.scale.linear()
        .domain([min, max])
        .range([0, chartWidth]);

    var colorScale = d3.scale.ordinal()
        .domain(_.pluck(config['data'], categoryColumn))
        .range([ COLORS['red3'], COLORS['yellow3'], COLORS['blue3'], COLORS['orange3'], COLORS['teal3'] ]);

    /*
     * Create D3 axes.
     */
    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(ticksX)
        .tickFormat(function(d) {
            return d.toFixed(0) + '%';
        });

    /*
     * Render axes to chart.
     */
    chartElement.append('g')
        .attr('class', 'x axis')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxis);

    /*
     * Render grid to chart.
     */
    var xAxisGrid = function() {
        return xAxis;
    };

    chartElement.append('g')
        .attr('class', 'x grid')
        .attr('transform', makeTranslate(0, chartHeight))
        .call(xAxisGrid()
            .tickSize(-chartHeight, 0, 0)
            .tickFormat('')
        );

    /*
     * Render bars to chart.
     */
    chartElement.append('g')
        .attr('class', 'bars')
        .selectAll('rect')
        .data(config['data'])
        .enter()
        .append('rect')
            .attr('x', function(d) {
                if (d[valueColumn] >= 0) {
                    return xScale(0);
                }

                return xScale(d[valueColumn]);
            })
            .attr('width', function(d) {
                return Math.abs(xScale(0) - xScale(d[valueColumn]));
            })
            .attr('y', function(d, i) {
                return i * (barHeight + barGap);
            })
            .attr('height', barHeight)
            .attr('class', function(d, i) {
                return 'bar-' + i + ' ' + classify(d[labelColumn]);
            })
            .style('fill', function(d) {
                return colorScale(d[categoryColumn])
            });

    /*
     * Render pattern bars to chart.
     */
    chartElement.append('g')
        .attr('class', 'patterns')
        .selectAll('rect')
        .data(config['data'])
        .enter()
        .append('rect')
            .attr('x', function(d) {
                if (d[valueColumn] >= 0) {
                    return xScale(0);
                }

                return xScale(d[valueColumn]);
            })
            .attr('width', function(d) {
                return Math.abs(xScale(0) - xScale(d[valueColumn]));
            })
            .attr('y', function(d, i) {
                return i * (barHeight + barGap);
            })
            .attr('height', barHeight)
            .attr('class', function(d, i) {
                return 'bar-' + i + ' ' + classify(d[labelColumn]);
            })
            .style('fill', function(d) {
                if ( !d[labelColumn].match(/non-concentrator/) && d[labelColumn].match(/concentrator/) ) {
                    return 'url(#stripe-pattern)';
                }
                else {
                    return 'rgba(0,0,0,0)'; 
                }
                return colorScale(d[categoryColumn])
            });

    /*
     * Render 0-line.
     */
    if (min < 0) {
        chartElement.append('line')
            .attr('class', 'zero-line')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', 0)
            .attr('y2', chartHeight);
    }

    /*
     * Render bar labels.
     */
    chartWrapper.append('ul')
        .attr('class', 'labels')
        .attr('style', formatStyle({
            'width': labelWidth + 'px',
            'top': margins['top'] + 'px',
            'left': '0'
        }))
        .selectAll('li')
        .data(config['data'])
        .enter()
        .append('li')
            .attr('style', function(d, i) {
                if ( xScale(d[valueColumn]) < labelWidth && d[valueColumn] < .5 * chartWidth ) {
                    return formatStyle({
                        'width': (chartWidth - xScale(d[valueColumn]) - 32) + 'px',
                        'height': barHeight + 'px',
                        'left': (xScale(d[valueColumn]) + 32) + 'px',
                        'top': (i * (barHeight + barGap)) + 'px;',
                    });
                }
                else {
                    return formatStyle({
                        'width': labelWidth + 'px',
                        'height': barHeight + 'px',
                        'left': '0px',
                        'top': (i * (barHeight + barGap)) + 'px;',
                    });
                }
            })
            .attr('class', function(d) {
                if ( xScale(d[valueColumn]) < labelWidth && d[valueColumn] < .5 * chartWidth ) {
                    return classify(d[labelColumn]) + " outside";
                }
                else {
                    return classify(d[labelColumn]);
                }
            })
            .append('span')
                .text(function(d) {
                    return d[labelColumn];
                })
            .style('background', function(d) {
                return colorScale(d[categoryColumn])
            });

    /*
     * Render bar values.
     */
    chartElement.append('g')
        .attr('class', 'value')
        .selectAll('text')
        .data(config['data'])
        .enter()
        .append('text')
            .text(function(d) {
                return d[valueColumn].toFixed(0) + '%';
            })
            .attr('x', function(d) {
                return xScale(d[valueColumn]);
            })
            .attr('y', function(d, i) {
                return i * (barHeight + barGap);
            })
            .attr('dx', function(d) {
                var xStart = xScale(d[valueColumn]);
                var textWidth = this.getComputedTextLength()

                // Negative case
                if (d[valueColumn] < 0) {
                    var outsideOffset = -(valueGap + textWidth);

                    if (xStart + outsideOffset < 0) {
                        d3.select(this).classed('in', true)
                        return valueGap;
                    } else {
                        d3.select(this).classed('out', true)
                        return outsideOffset;
                    }
                // Positive case
                } else {
                    if (xStart + valueGap + textWidth > chartWidth) {
                        d3.select(this).classed('in', true)
                        return -(valueGap + textWidth);
                    } else {
                        d3.select(this).classed('out', true)
                        return valueGap;
                    }
                }
            })
            .attr('dy', (barHeight / 2) + 3)
}

/*
 * Wrap a block of text to a given width
 * via http://bl.ocks.org/mbostock/7555321
 */
var wrapText = function(texts, width, lineHeight) {
    texts.each(function() {
        var text = d3.select(this);
        var words = text.text().split(/\s+/).reverse();

        var word = null;
        var line = [];
        var lineNumber = 0;

        var x = text.attr('x');
        var y = text.attr('y');

        var dx = parseFloat(text.attr('dx'));
        var dy = parseFloat(text.attr('dy'));

        var tspan = text.text(null)
            .append('tspan')
            .attr('x', x)
            .attr('y', y)
            .attr('dx', dx + 'px')
            .attr('dy', dy + 'px');

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(' '));

            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(' '));
                line = [word];

                lineNumber += 1;

                tspan = text.append('tspan')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('dx', dx + 'px')
                    .attr('dy', lineNumber * lineHeight + 'px')
                    .attr('text-anchor', 'begin')
                    .text(word);
            }
        }
    });
}

/*
 * Select an element and move it to the front of the stack
 */
d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
        this.parentNode.appendChild(this);
    });
};

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
