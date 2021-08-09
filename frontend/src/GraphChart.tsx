import React from "react";
import * as d3 from "d3";
import rawData from "./data.json";
import { ForceLink } from "d3";
import styled from "styled-components";

console.log("rawData", rawData);

type Node = {
  id: String;
};

type Connection = {
  source: String;
  destination: String;
  timestamp: Date;
};

type GraphData = {
  nodes: Node[];
  connections: Connection[];
};

const data = {
  nodes: rawData.nodes.map((d) => ({
    ...d,
    start: new Date(d.start).getTime(),
    end: new Date(d.end).getTime(),
  })),
  links: rawData.links.map((d) => ({
    ...d,
    start: new Date(d.start).getTime(),
    end: new Date(d.end).getTime(),
  })),
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

    const simulation = d3
      .forceSimulation()
      .force("charge", d3.forceManyBody())
      .force(
        "link",
        d3.forceLink().id((d: any) => d.id)
      )
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .on("tick", ticked);

    const svg = d3
      .select(svgRef.current)
      .attr(
        "viewBox",
        [-svgWidth / 2, -svgHeight / 2, svgWidth, svgHeight]
          .map(String)
          .join(" ")
      );

    // Clear svg content before adding new elements
    svg.selectAll("*").remove();

    let link = svg
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line");

    let node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle");

    function ticked() {
      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);

      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
    }

    const chart = Object.assign(svg.node(), {
      update({ nodes, links }: { nodes: any; links: any }) {
        // Make a shallow copy to protect against mutation, while
        // recycling old nodes to preserve position and velocity.
        const old = new Map(node.data().map((d: any) => [d.id, d]));
        nodes = nodes.map((d: any) => Object.assign(old.get(d.id) || {}, d));
        links = links.map((d: any) => Object.assign({}, d));

        node = node
          .data(nodes, (d: any) => d.id)
          .join((enter) =>
            enter
              .append("circle")
              .attr("r", 5)
              // .call(drag(simulation))
              .call((node) => node.append("title").text((d: any) => d.id))
          );

        link = link
          .data(links, (d: any): any => [d.source, d.target])
          .join("line");

        simulation.nodes(nodes);
        simulation.force<ForceLink<any, any>>("link")?.links(links);
        simulation.alpha(1).restart().tick();
        ticked(); // render now!
      },
    });

    const contains = (
      { start, end }: { start: number; end: number; id: string },
      time: number | Date
    ) => start - 2000 <= time && time < end + 2000;

    const times = d3
      .scaleTime()
      .domain([
        d3.min(data.nodes, (d: any) => d.start),
        d3.max(data.nodes, (d: any) => d.end),
      ])
      .ticks(100)
      .filter((time) => data.nodes.some((d) => contains(d, time)));

    function update(time: Date) {
      const nodes = data.nodes.filter((d: any) => contains(d, time));
      const links = data.links.filter((d: any) => contains(d, time));
      (chart as any).update({ nodes, links });
    }

    let i = 0;

    function doUpdate() {
      if (i >= times.length) {
        i = 0;
      }
      update(times[i++]);

      setTimeout(doUpdate, 500);
    }

    doUpdate();
  }, []);

  return <SvgContainer ref={svgRef} width={svgWidth} height={svgHeight} />;
}

const SvgContainer = styled.svg`
  outline: 1px solid red;
`;

export default GraphChart;
