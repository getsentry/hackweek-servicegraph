import React from "react";
import RangeSlider from "./timeslider";
import _ from "lodash";
import styled from "styled-components";

import { HistogramData } from "./types";

type Props = {
  data: HistogramData;
  setStartDate: (date: Date) => void;
  setEndDate: (date: Date) => void;
};

type State = {
  selectedRange: Date[];
  selectedData: any[];
};

class RangeSliderComponent extends React.Component<Props, State> {
  state: State = {
    selectedRange: [],
    selectedData: [],
  };

  node = React.createRef<HTMLDivElement>();
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
    if (prevProps.data === this.props.data) {
      return;
    }
    this.createDiagram();
  }

  createDiagram = () => {
    const node = this.node.current;
    if (!this.props.data || !node) {
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

    this.chart
      .container(node)
      .svgWidth(500)
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

  render() {
    // console.log(this.state);
    return (
      <TimerangeContainer>
        <div>
          <small>
            selected range{" "}
            {this.state.selectedRange.length &&
              `${this.state.selectedRange[0].toLocaleDateString(
                "en"
              )} ${this.state.selectedRange[0].toLocaleTimeString("en")}`}{" "}
            ,{" "}
            {this.state.selectedRange.length &&
              `${this.state.selectedRange[1].toLocaleDateString(
                "en"
              )} ${this.state.selectedRange[1].toLocaleTimeString("en")}`}
          </small>
        </div>
        <div>
          <small>
            selected data length - {this.state.selectedData.length}{" "}
          </small>
        </div>
        <div
          style={{
            // marginTop: "50px",
            borderRadius: "5px",
            paddingTop: "20px",
            paddingLeft: "20px",
            backgroundColor: "#30363E",
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "600px",
            height: "120px",
          }}
          ref={this.node}
        />
      </TimerangeContainer>
    );
  }
}

const TimerangeContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 600px;
  height: 170px;
  outline: 1px solid red;
`;

export default RangeSliderComponent;
