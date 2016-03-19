'use strict';

var svg, tooltip, biHiSankey, path, defs, colorScale, highlightColorScale, isTransitioning;

var OPACITY = {
    NODE_DEFAULT: 0.9,
    NODE_FADED: 0.1,
    NODE_HIGHLIGHT: 0.8,
    LINK_DEFAULT: 0.6,
    LINK_FADED: 0.05,
    LINK_HIGHLIGHT: 0.9
  },
  TYPES = ["Dimensión1", "Dimensión2", "Dimensión3", "Dimensión4", "Dimensión5", "Dimensión6", "Dimensión7"],
  TYPE_COLORS = ["#E8BA20", "#D47F23", "#AE007E", "#673C8B", "#009BDB", "#7C7B7E", "#0095B0"],
  TYPE_HIGHLIGHT_COLORS = ["#EFCF90", "#E0A87A", "#C87AAB", "#9274AA", "#92BED6", "#ADADAD", "#77B5BD"],
  LINK_COLOR = "#b3b3b3",
  INFLOW_COLOR = "#349642",
  OUTFLOW_COLOR = "#D63028",
  NODE_WIDTH = 36,
  COLLAPSER = {
    RADIUS: NODE_WIDTH / 2,
    SPACING: 2
  },
  OUTER_MARGIN = 10,
  MARGIN = {
    TOP: 2 * (COLLAPSER.RADIUS + OUTER_MARGIN),
    RIGHT: OUTER_MARGIN,
    BOTTOM: OUTER_MARGIN,
    LEFT: OUTER_MARGIN
  },
  TRANSITION_DURATION = 400,
  HEIGHT = 900 - MARGIN.TOP - MARGIN.BOTTOM,
  WIDTH = 960 - MARGIN.LEFT - MARGIN.RIGHT,
  LAYOUT_INTERATIONS = 32,
  REFRESH_INTERVAL = 7000;

var formatNumber = function (d) {
  var numberFormat = d3.format(",.0f"); // zero decimal places
  return numberFormat(d);
},

formatFlow = function (d) {
  var flowFormat = d3.format(",.0f"); // zero decimal places with sign
  return  flowFormat(Math.abs(d));
},

// Used when temporarily disabling user interractions to allow animations to complete
disableUserInterractions = function (time) {
  isTransitioning = true;
  setTimeout(function(){
    isTransitioning = false;
  }, time);
},

hideTooltip = function () {
  return tooltip.transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", 0);
},

showTooltip = function () {
 return tooltip
   
    .style("left", d3.event.pageX  + "px")
    .style("top", d3.event.pageY + 15 + "px")
    .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", 1);
};

colorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_COLORS),
highlightColorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_HIGHLIGHT_COLORS),

svg = d3.select("#chart").append("svg")
        .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
        .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
      .append("g")
        .attr("transform", "translate(" + MARGIN.LEFT + "," + MARGIN.TOP + ")");

svg.append("g").attr("id", "links");
svg.append("g").attr("id", "nodes");
svg.append("g").attr("id", "collapsers");

tooltip = d3.select("#chart").append("div").attr("id", "tooltip");

tooltip.style("opacity", 0)
    .append("p")
      .attr("class", "value");

biHiSankey = d3.biHiSankey();

// Set the biHiSankey diagram properties
biHiSankey
  .nodeWidth(NODE_WIDTH)
  .nodeSpacing(10)
  .linkSpacing(4)
  .arrowheadScaleFactor(0.5) // Specifies that 0.5 of the link's stroke WIDTH should be allowed for the marker at the end of the link.
  .size([WIDTH, HEIGHT]);

path = biHiSankey.link().curvature(0.45);

defs = svg.append("defs");

defs.append("marker")
  .style("fill", LINK_COLOR)
  .attr("id", "arrowHead")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

defs.append("marker")
  .style("fill", OUTFLOW_COLOR)
  .attr("id", "arrowHeadInflow")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

defs.append("marker")
  .style("fill", INFLOW_COLOR)
  .attr("id", "arrowHeadOutlow")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

function update () {
  var link, linkEnter, node, nodeEnter, collapser, collapserEnter;

  function dragmove(node) {
    node.x = Math.max(0, Math.min(WIDTH - node.width, d3.event.x));
    node.y = Math.max(0, Math.min(HEIGHT - node.height, d3.event.y));
    d3.select(this).attr("transform", "translate(" + node.x + "," + node.y + ")");
    biHiSankey.relayout();
    svg.selectAll(".node").selectAll("rect").attr("height", function (d) { return d.height; });
    link.attr("d", path);
  }

  function containChildren(node) {
    node.children.forEach(function (child) {
      child.state = "contained";
      child.parent = this;
      child._parent = null;
      containChildren(child);
    }, node);
  }

  function expand(node) {
    node.state = "expanded";
    node.children.forEach(function (child) {
      child.state = "collapsed";
      child._parent = this;
      child.parent = null;
      containChildren(child);
    }, node);
  }

  function collapse(node) {
    node.state = "collapsed";
    containChildren(node);
  }

  function restoreLinksAndNodes() {
    link
      .style("stroke", LINK_COLOR)
      .style("marker-end", function () { return 'url(#arrowHead)'; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.LINK_DEFAULT);

    node
      .selectAll("rect")
        .style("fill", function (d) {
          d.color = colorScale(d.type.replace(/ .*/, ""));
          return d.color;
        })
        .style("stroke", function (d) {
          return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
        })
        .style("fill-opacity", OPACITY.NODE_DEFAULT);

    node.filter(function (n) { return n.state === "collapsed"; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.NODE_DEFAULT);
  }

  function showHideChildren(node) {
    disableUserInterractions(2 * TRANSITION_DURATION);
    hideTooltip();
    if (node.state === "collapsed") { expand(node); }
    else { collapse(node); }

    biHiSankey.relayout();
    update();
    link.attr("d", path);
    restoreLinksAndNodes();
  }

  function highlightConnected(g) {
    link.filter(function (d) { return d.source === g; })
      .style("marker-end", function () { return 'url(#arrowHeadInflow)'; })
      .style("stroke", OUTFLOW_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);

    link.filter(function (d) { return d.target === g; })
      .style("marker-end", function () { return 'url(#arrowHeadOutlow)'; })
      .style("stroke", INFLOW_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);
  }

  function fadeUnconnected(g) {
    link.filter(function (d) { return d.source !== g && d.target !== g; })
      .style("marker-end", function () { return 'url(#arrowHead)'; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.LINK_FADED);

    node.filter(function (d) {
      return (d.name === g.name) ? false : !biHiSankey.connected(d, g);
    }).transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.NODE_FADED);
  }

  link = svg.select("#links").selectAll("path.link")
    .data(biHiSankey.visibleLinks(), function (d) { return d.id; });

  link.transition()
    .duration(TRANSITION_DURATION)
    .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
    .attr("d", path)
    .style("opacity", OPACITY.LINK_DEFAULT);


  link.exit().remove();


  linkEnter = link.enter().append("path")
    .attr("class", "link")
    .style("fill", "none");

  linkEnter.on('mouseenter', function (d) {
    if (!isTransitioning) {
      showTooltip().select(".value").text(function () {
        //if (d.direction > 0) {
          return d.source.name + " > " + d.target.name + "\n" + formatNumber(d.value/100);
           //} 
        //return d.target.name + " ? " + d.source.name + "\n" + formatNumber(d.value/100);
     });

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
          .duration(TRANSITION_DURATION / 2)
          .style("opacity", OPACITY.LINK_HIGHLIGHT);
    }
  });

  linkEnter.on('mouseleave', function () {
    if (!isTransitioning) {
      hideTooltip();

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
          .duration(TRANSITION_DURATION / 2)
          .style("opacity", OPACITY.LINK_DEFAULT);
    }
  });

  linkEnter.sort(function (a, b) { return b.thickness - a.thickness; })
    .classed("leftToRight", function (d) {
      return d.direction > 0;
    })
    .classed("rightToLeft", function (d) {
      return d.direction < 0;
    })
    .style("marker-end", function () {
      return 'url(#arrowHead)';
    })
    .style("stroke", LINK_COLOR)
    .style("opacity", 0)
    .transition()
      .delay(TRANSITION_DURATION)
      .duration(TRANSITION_DURATION)
      .attr("d", path)
      .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
      .style("opacity", OPACITY.LINK_DEFAULT);


  node = svg.select("#nodes").selectAll(".node")
      .data(biHiSankey.collapsedNodes(), function (d) { return d.id; });


  node.transition()
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
    .style("opacity", OPACITY.NODE_DEFAULT)
    .select("rect")
      .style("fill", function (d) {
        d.color = colorScale(d.type.replace(/ .*/, ""));
        return d.color;
      })
      .style("stroke", function (d) { return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1); })
      .style("stroke-WIDTH", "1px")
      .attr("height", function (d) { return d.height; })
      .attr("width", biHiSankey.nodeWidth());


  node.exit()
    .transition()
      .duration(TRANSITION_DURATION)
      .attr("transform", function (d) {
        var collapsedAncestor, endX, endY;
        collapsedAncestor = d.ancestors.filter(function (a) {
          return a.state === "collapsed";
        })[0];
        endX = collapsedAncestor ? collapsedAncestor.x : d.x;
        endY = collapsedAncestor ? collapsedAncestor.y : d.y;
        return "translate(" + endX + "," + endY + ")";
      })
      .remove();


  nodeEnter = node.enter().append("g").attr("class", "node");

  nodeEnter
    .attr("transform", function (d) {
      var startX = d._parent ? d._parent.x : d.x,
          startY = d._parent ? d._parent.y : d.y;
      return "translate(" + startX + "," + startY + ")";
    })
    .style("opacity", 1e-6)
    .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.NODE_DEFAULT)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

  nodeEnter.append("text");
  nodeEnter.append("rect")
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    })
    .style("stroke", function (d) {
      return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
    })
    .style("stroke-WIDTH", "1px")
    .attr("height", function (d) { return d.height; })
    .attr("width", biHiSankey.nodeWidth());

  node.on("mouseenter", function (g) {
    if (!isTransitioning) {
      restoreLinksAndNodes();
      highlightConnected(g);
      fadeUnconnected(g);

      d3.select(this).select("rect")
        .style("fill", function (d) {
          d.color = d.netFlow > 0 ? INFLOW_COLOR : OUTFLOW_COLOR;
          return d.color;
        })
        .style("stroke", function (d) {
          return d3.rgb(d.color).darker(0.1);
        })
        .style("fill-opacity", OPACITY.LINK_DEFAULT);

      tooltip
        .style("left", g.x + MARGIN.LEFT + 200 + "px")
        .style("top", g.y + g.height + MARGIN.TOP + 300 + "px")
        .transition()
          .duration(TRANSITION_DURATION)
          .style("opacity", 1).select(".value")
          .text(function () {
            var additionalInstructions = g.children.length ? "\n(Double click to expand)" : "";
            //return g.name + "\nAporta a " + (g.sourceLinks.length)/2 + " Indicadores"  + additionalInstructions;
          //return Math.min(WIDTH - node.width, d3.event.x);
          return g.number;
              
          });
    }
  });

  node.on("mouseleave", function () {
    if (!isTransitioning) {
      hideTooltip();
      restoreLinksAndNodes();
    }
  });

  node.filter(function (d) { return d.children.length; })
    .on("dblclick", showHideChildren);

  // allow nodes to be dragged to new positions
  node.call(d3.behavior.drag()
    .origin(function (d) { return d; })
    .on("dragstart", function () { this.parentNode.appendChild(this); })
    .on("drag", dragmove));

  // add in the text for the nodes
  node.filter(function (d) { return d.value !== 0; })
    .select("text")
      .attr("x", -6)
      .attr("y", function (d) { return d.height / 2; })
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .attr("transform", null)
      .text(function (d) { return d.name; })
    .filter(function (d) { return d.x < WIDTH / 2; })
      .attr("x", 6 + biHiSankey.nodeWidth())
      .attr("text-anchor", "start");


  collapser = svg.select("#collapsers").selectAll(".collapser")
    .data(biHiSankey.expandedNodes(), function (d) { return d.id; });


  collapserEnter = collapser.enter().append("g").attr("class", "collapser");

  collapserEnter.append("circle")
    .attr("r", COLLAPSER.RADIUS)
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    });

  collapserEnter
    .style("opacity", OPACITY.NODE_DEFAULT)
    .attr("transform", function (d) {
      return "translate(" + (d.x + d.width / 2) + "," + (d.y + COLLAPSER.RADIUS) + ")";
    });

  collapserEnter.on("dblclick", showHideChildren);

  collapser.select("circle")
    .attr("r", COLLAPSER.RADIUS);

  collapser.transition()
    .delay(TRANSITION_DURATION)
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d, i) {
      return "translate("
        + (COLLAPSER.RADIUS + i * 2 * (COLLAPSER.RADIUS + COLLAPSER.SPACING))
        + ","
        + (-COLLAPSER.RADIUS - OUTER_MARGIN)
        + ")";
    });

  collapser.on("mouseenter", function (g) {
    if (!isTransitioning) {
      showTooltip().select(".value")
        .text(function () {
          return g.name + "\n(Double click to collapse)";
        });

      var highlightColor = highlightColorScale(g.type.replace(/ .*/, ""));

      d3.select(this)
        .style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("circle")
          .style("fill", highlightColor);

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("rect")
          .style("fill", highlightColor);
    }
  });

  collapser.on("mouseleave", function (g) {
    if (!isTransitioning) {
      hideTooltip();
      d3.select(this)
        .style("opacity", OPACITY.NODE_DEFAULT)
        .select("circle")
          .style("fill", function (d) { return d.color; });

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_DEFAULT)
        .select("rect")
          .style("fill", function (d) { return d.color; });
    }
  });

  collapser.exit().remove();

}

var exampleNodes = [
  {
    "type": "Dimensión1",
    "id": "1.1",
    "parent": "1",
    "number": "1",
    "name": "1.Confianza interpersonal"
  },
  {
    "type": "Dimensión1",
    "id": "1.2",
    "parent": "1",
    "number": "1",
    "name": "1.Confianza institucional"
  },
  {
    "type": "Dimensión1",
    "id": "1.3",
    "parent": "1",
    "number": "1",
    "name": "1.Indice de Cultura Ciudadana"
  },
  {
    "type": "Dimensión2",
    "id": "2.1",
    "parent": "2",
    "number": "2",
    "name": "2.Nivel de percepción de seguridad"
  },
  {
    "type": "Dimensión2",
    "id": "2.2",
    "parent": "2",
    "number": "2",
    "name": "2.Nivel de victimización"
  },
  {
    "type": "Dimensión3",
    "id": "3.1",
    "parent": "3",
    "number": "3",
    "name": "3.Percepción calidad de vida buena y muy buena"
  },
  {
    "type": "Dimensión3",
    "id": "3.2",
    "parent": "3",
    "number": "3",
    "name": "3.Indice de Progeso Social"
  },
  {
    "type": "Dimensión4",
    "id": "4.1",
    "parent": "4",
    "number": "4",
    "name": "4. Índice de Desarrollo Humano"
  },
  {
    "type": "Dimensión4",
    "id": "4.2",
    "parent": "4",
    "number": "4",
    "name": "4. Tasa de desempleo"
  },
  {
    "type": "Dimensión4",
    "id": "4.3",
    "parent": "4",
    "number": "4",
    "name": "4.Desempleo entre 18 y 28 años"
  },
  {
    "type": "Dimensión4",
    "id": "4.4",
    "parent": "4",
    "number": "4",
    "name": "4.Tasa de informalidad"
  },
  {
    "type": "Dimensión4",
    "id": "4.5",
    "parent": "4",
    "number": "4",
    "name": "4.Tasa de informalidad DANE"
  },
  {
    "type": "Dimensión4",
    "id": "4.6",
    "parent": "4",
    "number": "4",
    "name": "4.Tasa de trabajo infantil Medellín"
  },
  {
    "type": "Dimensión4",
    "id": "4.7",
    "parent": "4",
    "number": "4",
    "name": "4. Índice de competitividad urbana (ICUR)"
  },
  {
    "type": "Dimensión4",
    "id": "4.8",
    "parent": "4",
    "number": "4",
    "name": "4. Producto Interno Bruto"
  },
  {
    "type": "Dimensión4",
    "id": "4.9",
    "parent": "4",
    "number": "4",
    "name": "4.Contribución de la cultura al desarrollo"
  },
  {
    "type": "Dimensión4",
    "id": "4.10",
    "parent": "4",
    "number": "4",
    "name": "4. Años de estudio población de 15 a 24 años"
  },
  {
    "type": "Dimensión5",
    "id": "5.1",
    "parent": "5",
    "number": "5",
    "name": "5. Emisiones de CO2 dejadas de emitir"
  },
  {
    "type": "Dimensión5",
    "id": "5.2",
    "parent": "5",
    "number": "5",
    "name": "5. Tiempo Promedio de Desplazamiento "
  },
  {
    "type": "Dimensión5",
    "id": "5.3",
    "parent": "5",
    "number": "5",
    "name": "5. Distribución modal"
  },
  {
    "type": "Dimensión6",
    "id": "6.1",
    "parent": "6",
    "number": "6",
    "name": "6. Dimensión Entorno y Calidad de la Vivienda"
  },
  {
    "type": "Dimensión6",
    "id": "6.2",
    "parent": "6",
    "number": "6",
    "name": "6. Compromisos POT (en construcción)"
  },
  {
    "type": "Dimensión7",
    "id": "7.1",
    "parent": "7",
    "number": "7",
    "name": "7. Dimensión Medio Ambiente"
  },
  {
    "type": "Dimensión7",
    "id": "7.2",
    "parent": "7",
    "number": "7",
    "name": "7. Dimensión Acceso a servicios públicos"
  },
  {
    "type": "Dimensión7",
    "id": "7.3",
    "parent": "7",
    "number": "7",
    "name": "7. Índice de Sostenibilidad Ambiental"
  },
  {
    "type": "Dimensión1",
    "id": "1",
    "name": "Dimensión 1",
    "number": "10"
  },
  {
    "type": "Dimensión2",
    "id": "2",
    "name": "Dimensión 2",
    "number": "2"
  },
  {
    "type": "Dimensión3",
    "id": "3",
    "name": "Dimensión 3",
    "number": "3"
  },
  {
    "type": "Dimensión4",
    "id": "4",
    "name": "Dimensión 4",
    "number": "4"
  },
  {
    "type": "Dimensión5",
    "id": "5",
    "name": "Dimensión 5",
    "number": "5"
  },
  {
    "type": "Dimensión6",
    "id": "6",
    "name": "Dimensión 6",
    "number": "6"
  },
  {
    "type": "Dimensión7",
    "id": "7",
    "name": "Dimensión 7",
    "number": "7"
  }
]

var exampleLinks = [
            {
                "source": "1.1",
                "target": "2.1",
                "value": 100
            },
            {
                "source": "1.1",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "1.2",
                "target": "2.1",
                "value": 100 
                
            },
            {
                "source": "1.2",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "1.2",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "2.1",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "2.1",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "2.1",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "2.2",
                "target": "2.1",
                "value": 100
            },
            {
                "source": "2.2",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "2.2",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.1",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.1",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.2",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "4.2",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.2",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.3",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "4.3",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.3",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.4",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "4.4",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.4",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.5",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "4.5",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.5",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.6",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "4.6",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.6",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.7",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.7",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.8",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.8",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.9",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "4.9",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.9",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "4.10",
                "target": "1.2",
                "value": 100
            },
            {
                "source": "4.10",
                "target": "1.3",
                "value": 100
            },
            {
                "source": "4.10",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "4.10",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "5.1",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "5.1",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "5.1",
                "target": "4.1",
                "value": 100
            },
            {
                "source": "5.1",
                "target": "4.7",
                "value": 100
            },
            {
                "source": "5.1",
                "target": "6.2",
                "value": 100
            },
            {
                "source": "5.1",
                "target": "7.1",
                "value": 100
            },
            {
                "source": "5.1",
                "target": "7.3",
                "value": 100
            },
            {
                "source": "5.2",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "5.2",
                "target": "4.7",
                "value": 100
            },
            {
                "source": "5.2",
                "target": "6.2",
                "value": 100
            },
            {
                "source": "5.3",
                "target": "1.3",
                "value": 100
            },
            {
                "source": "5.3",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "5.3",
                "target": "6.2",
                "value": 100
            },
            {
                "source": "6.1",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "6.1",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "6.1",
                "target": "4.8",
                "value": 100
            },
            {
                "source": "6.2",
                "target": "4.7",
                "value": 100
            },
            {
                "source": "6.2",
                "target": "7.3",
                "value": 100
            },
            {
                "source": "7.1",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "7.1",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "7.1",
                "target": "4.7",
                "value": 100
            },
            {
                "source": "7.2",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "7.2",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "7.3",
                "target": "3.1",
                "value": 100
            },
            {
                "source": "7.3",
                "target": "3.2",
                "value": 100
            },
            {
                "source": "7.3",
                "target": "4.7",
                "value": 100
            }
        ]

biHiSankey
  .nodes(exampleNodes)
  .links(exampleLinks)
  .initializeNodes(function (node) {
    node.state = node.parent ? "contained" : "collapsed";
  })
  .layout(LAYOUT_INTERATIONS);

disableUserInterractions(2 * TRANSITION_DURATION);

update();
