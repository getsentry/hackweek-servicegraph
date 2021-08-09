import React from "react";
import * as d3 from "d3";
import rawData from "./data.json";
import { ForceLink, SimulationNodeDatum, SimulationLinkDatum } from "d3";
import styled from "styled-components";

console.log("rawData", rawData);

interface Node extends SimulationNodeDatum {
  id: String;
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

    const simulation = d3
      .forceSimulation()
      .force("charge", d3.forceManyBody())
      .force(
        "link",
        d3.forceLink<Node, Connection>().id((d: Node) => {
          return String(d.id);
        })
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
      .selectAll<SVGSVGElement, Connection>("line");

    let node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll<SVGCircleElement, Node>("circle");

    function ticked() {
      node
        .attr("cx", (d: Node) => {
          // console.log("d", d);
          return d.x ?? 0;
        })
        .attr("cy", (d: Node) => d.y ?? 0);

      link
        .attr("x1", (d: Connection) => (d.source as Node).x ?? 0)
        .attr("y1", (d: Connection) => (d.source as Node).y ?? 0)
        .attr("x2", (d: Connection) => (d.target as Node).x ?? 0)
        .attr("y2", (d: Connection) => (d.target as Node).y ?? 0);
    }

    const chart: d3.BaseType & {
      update({ nodes, links }: { nodes: Node[]; links: Connection[] }): void;
    } = Object.assign(svg.node(), {
      update({ nodes, links }: { nodes: Node[]; links: Connection[] }) {
        // Make a shallow copy to protect against mutation, while
        // recycling old nodes to preserve position and velocity.
        const old = new Map(node.data().map((d: Node) => [d.id, d]));
        nodes = nodes.map((d: Node) => Object.assign(old.get(d.id) || {}, d));
        links = links.map((d: Connection) => Object.assign({}, d));

        node = node
          .data(nodes, (d: Node) => String(d.id))
          .join((enter) =>
            enter
              .append("circle")
              // radius
              .attr("r", 5)
              // .call(drag(simulation))
              .call((node) =>
                node.append("title").text((d: Node) => String(d.id))
              )
          );

        link = link
          .data(links, (d: Connection) => String([d.source, d.target]))
          .join<SVGSVGElement, Connection>("line");

        simulation.nodes(nodes as any[]);
        simulation.force<ForceLink<Node, Connection>>("link")?.links(links);
        simulation.alpha(1).restart().tick();
        ticked(); // render now!
      },
    });

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

    function update(time: Date) {
      const nodes = data.nodes.filter((d: Node) => contains(d, time));
      const links = data.links.filter((d: Connection) => contains(d, time));
      chart.update({ nodes, links });
    }

    let i = 0;
    let timeoutID: NodeJS.Timeout | undefined = undefined;

    function doUpdate() {
      if (i >= times.length) {
        i = 0;
      }
      update(times[i]);

      timeoutID = setTimeout(doUpdate, 1000);
    }

    doUpdate();

    return () => {
      if (timeoutID) {
        clearTimeout(timeoutID);
      }
    };
  });

  return <SvgContainer ref={svgRef} width={svgWidth} height={svgHeight} />;
}

const SvgContainer = styled.svg`
  outline: 1px solid red;
`;

export default GraphChart;
