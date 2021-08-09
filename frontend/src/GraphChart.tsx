import React from "react";
import * as d3 from "d3";
import rawData from "./data.json";
import { ForceLink, SimulationNodeDatum, SimulationLinkDatum } from "d3";
import styled from "styled-components";

console.log("rawData", rawData);

interface Node extends SimulationNodeDatum {
  id: string;
  start: number;
  end: number;
}

interface Connection extends SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  start: number;
  end: number;
}

type GraphData = {
  nodes: Node[];
  links: Connection[];
};

const data: GraphData = {
  nodes: rawData.nodes.map((d: any): Node => {
    return {
      ...d,
      start: new Date(d.start).getTime(),
      end: new Date(d.end).getTime(),
    };
  }),
  links: rawData.links.map((d: any): Connection => {
    return {
      ...d,
      start: new Date(d.start).getTime(),
      end: new Date(d.end).getTime(),
    };
  }),
};

// const data: GraphData = {
//   nodes: [
//     {
//       id: "1",
//     },
//     { id: "2" },
//   ],
//   connections: [
//     {
//       source: "1",
//       destination: "2",
//       timestamp: new Date(),
//     },
//   ],
// };

function GraphChart() {
  const dimensions = {
    width: 600,
    height: 300,
    margin: { top: 30, right: 30, bottom: 30, left: 30 },
  };

  const { width, height, margin } = dimensions;
  const svgWidth = width + margin.left + margin.right;
  const svgHeight = height + margin.top + margin.bottom;

  const svgRef = React.useRef(null);

  React.useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const contains = ({ start, end }: Node | Connection, time: Date) => {
      return start <= time.getTime() && time.getTime() < end;
    };

    const times = d3
      .scaleTime()
      .domain([
        d3.min(data.nodes, (d: Node) => d.start) as number,
        d3.max(data.nodes, (d: Node) => d.end) as number,
      ])
      .ticks(100)
      .filter((time) => data.nodes.some((d: Node) => contains(d, time)));

    const time = times[0];
    const links = data.links
      .map((d) => Object.create(d))
      .filter((d: Connection) => contains(d, time));
    const nodes = data.nodes
      .map((d) => Object.create(d))
      .filter((d: Node) => contains(d, time));

    // https://stackoverflow.com/a/57037786
    const setOfNodeIds = nodes.reduce((acc: Set<string>, d: Node) => {
      acc.add(d.id);
      return acc;
    }, new Set());
    const domain = Array.from(new Set(setOfNodeIds));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink<Node, Connection>(links).id((d) => d.id)
      )
      .force("charge", d3.forceManyBody())
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2));

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

    // Clear svg content before adding new elements
    svg.selectAll("*").remove();

    const link = svg
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.value));

    const node = svg
      .append("g")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node");

    node
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d) => {
        const index = domain.indexOf(d.id);
        if (index >= 0) {
          return d3.interpolateSinebow(index / domain.length);
        }
        return "#000";
      });

    node
      .append("text")
      .text(function (d) {
        return d.id;
      })
      .style("fill", "#000")
      .style("font-size", "12px")
      .attr("x", 6)
      .attr("y", 3);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  });

  return <SvgContainer ref={svgRef} width={svgWidth} height={svgHeight} />;
}

const SvgContainer = styled.svg`
  outline: 1px solid red;
`;

export default GraphChart;
