import React from "react";
import RangeSlider from "./timeslider";
import _ from "lodash";
import styled from "styled-components";

import { HistogramData } from "./types";

type Props = {
  data: HistogramData;
  setStartDate: (date: Date | undefined) => void;
  setEndDate: (date: Date | undefined) => void;
  remount: () => void;
};

type State = {
  selectedRange: Date[] | undefined;
  selectedData: string[] | undefined;
};

class RangeSliderComponent extends React.Component<Props, State> {
  state: State = {
    selectedRange: undefined,
    selectedData: undefined,
  };

  node = React.createRef<HTMLDivElement>();
  container = React.createRef<HTMLDivElement>();
  chart: any | undefined = undefined;

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    const propsNotEqual = !_.isEqual(this.props, nextProps);
    const stateNotEqual = !_.isEqual(this.state, nextState);
    return propsNotEqual || stateNotEqual;
  }

  componentDidMount() {
    this.createDiagram();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    this.createDiagram();
  }

  createDiagram = () => {
    const node = this.node.current;
    if (!this.props.data || this.props.data?.buckets.length === 0 || !node) {
      return;
    }
    if (!this.chart) {
      this.chart = new RangeSlider();
    }

    const processedData: string[] = this.props.data.buckets.flatMap(
      (bucket): string[] => {
        return Array(bucket.n).fill(bucket.ts);
      }
    );

    if (processedData.length === 0) {
      processedData.push(new Date().toISOString());
    }

    // console.log("processedData", processedData);

    // const processedData = this.props.data.buckets.filter(
    //   (bucket) => bucket.n > 0
    // );

    // console.log("create diagram");

    // console.log("processedData.length", processedData.length);

    this.chart
      .container(node)
      .svgWidth(550)
      //   .svgWidth(window.innerWidth - 50)
      .svgHeight(100)
      .data(processedData)
      //   .aggregator((bucket: Bucket) => bucket.n)
      //   .accessor((bucket: Bucket) => {
      //     console.log("bucket", bucket);
      //     return new Date(bucket.ts);
      //   })
      .accessor((ts: string) => {
        return new Date(ts);
      })
      .onBrush((d: any) => {
        this.setState({
          selectedRange: d.range,
          selectedData: d.data,
        });

        this.props.setStartDate(d.range[0]);
        this.props.setEndDate(d.range[1]);
      })
      .render();
  };

  generateStatus = () => {
    let status: string[] = [];

    if (this.state.selectedRange?.length === 2) {
      status.push(
        `${this.state.selectedRange[0].toLocaleDateString(
          "en"
        )} ${this.state.selectedRange[0].toLocaleTimeString(
          "en"
        )} to ${this.state.selectedRange[1].toLocaleDateString(
          "en"
        )} ${this.state.selectedRange[1].toLocaleTimeString("en")}`
      );
    }

    if (this.state.selectedData) {
      status.push(`${this.state.selectedData?.length ?? 0} data points`);
    }

    return (
      <React.Fragment>
        <span>{status.join(" \u00B7 ")}</span>
        <a
          href="#reset"
          onClick={(event) => {
            event.preventDefault();
            this.props.setStartDate(undefined);
            this.props.setEndDate(undefined);
            this.props.remount();
          }}
        >
          Reset
        </a>
      </React.Fragment>
    );
  };

  render() {
    // console.log(this.state);
    return (
      <TimerangeContainer ref={this.container}>
        <div
          style={{
            paddingTop: "40px",
            // paddingLeft: "10px",
            backgroundColor: "white",
            border: "2px solid black",
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "600px",
            height: "140px",
          }}
          ref={this.node}
        />
        <TimeRangeStatus className="text-xs">
          {this.generateStatus()}
        </TimeRangeStatus>
      </TimerangeContainer>
    );
  }
}

const TimerangeContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 600px;
  height: 140px;
  user-select: none;

  & .selection {
    fill: black !important;
  }
`;

const TimeRangeStatus = styled.div`
  position: absolute;
  top: 5px;
  left: 16px;
  width: 575px;
  height: 18px;
  color: #000;

  display: flex;
  justify-content: space-between;
`;

export default RangeSliderComponent;
