/** @format */

import Slider, { SliderThumb } from "@mui/material/Slider";
import { styled } from "@mui/material/styles";
import React, { SyntheticEvent, useCallback, useEffect, useState } from "react";
import { Theme } from "@mui/material/styles";

const BuffSlider = styled(Slider)(({ theme }: { theme: Theme }) => ({
  color: "#3a8589",
  height: 3,
  padding: "13px 0",
  "& .MuiSlider-thumb": {
    height: 27,
    width: 27,
    backgroundColor: "#fff",
    border: "1px solid currentColor",
    "&:hover": {
      boxShadow: "0 0 0 8px rgba(58, 133, 137, 0.16)",
    },
    "& .slide-bar": {
      height: 9,
      width: 1,
      backgroundColor: "currentColor",
      marginLeft: 1,
      marginRight: 1,
    },
    "&::before": {
      display: "none",
    },
  },
  "& .MuiSlider-track": {
    height: 3,
  },
}));

interface BuffThumbComponentProps extends React.HTMLAttributes<unknown> {}

function BuffThumbComponent(props: BuffThumbComponentProps) {
  const { children, ...other } = props;
  return (
    <SliderThumb {...other}>
      {children}
      <span className="slide-bar" />
      <span className="slide-bar" />
      <span className="slide-bar" />
    </SliderThumb>
  );
}

interface SliderInterface {
  id: string;
  initValue: number[];
  range: number[];
  onChange: (id: string, newValue: number[]) => void;
}

// Format epoch-ms timestamp as HH:MM:SS for the slider value label
function formatTimestamp(value: number): string {
  const date = new Date(value);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export const CustomSlider: React.FC<SliderInterface> = (
  prop: SliderInterface,
) => {
  const { id, initValue, range, onChange } = prop;
  const [value, setValue] = useState<number | number[]>(initValue);

  // Sync whenever the parent re-anchors initValue (e.g. on a fresh pause)
  useEffect(() => {
    setValue(initValue);
  }, [initValue[0], initValue[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // minDistance: 2 seconds in ms; maxDistance: 10 seconds in ms
  const minDistance = 2000;
  const maxDistance = 10000;

  const handleChange = useCallback(
    (event: Event, newValue: number | number[], activeThumb: number) => {
      console.log(newValue);
      if (Array.isArray(newValue)) {
        let valueToSet = newValue;
        const rangeMin = range[0];
        const rangeMax = range[1];

        if (newValue[1] - newValue[0] < minDistance) {
          // Enforce minimum window of 2 s
          if (activeThumb === 0) {
            const clamped = Math.min(newValue[0], rangeMax - minDistance);
            valueToSet = [clamped, clamped + minDistance];
          } else {
            const clamped = Math.max(newValue[1], rangeMin + minDistance);
            valueToSet = [clamped - minDistance, clamped];
          }
        } else if (newValue[1] - newValue[0] > maxDistance) {
          // Enforce maximum window of 10 s
          if (activeThumb === 0) {
            valueToSet = [newValue[0], newValue[0] + maxDistance];
          } else {
            valueToSet = [newValue[1] - maxDistance, newValue[1]];
          }
        }

        // Clamp both ends within the allowable range
        valueToSet = [
          Math.max(rangeMin, valueToSet[0]),
          Math.min(rangeMax, valueToSet[1]),
        ];

        console.log(valueToSet, valueToSet[1] - valueToSet[0]);
        setValue(valueToSet);
      }
    },
    [range],
  );

  // This function is called only when the slider release is committed
  const handleSlideComplete = (
    event: Event | SyntheticEvent<Element, Event>,
    newValue: number | number[],
  ) => {
    console.log(`Sliding complete. Final value is: ${newValue}    ${value}`);
    // Place your function call here, e.g., an API request.
    if (Array.isArray(newValue)) {
      onChange(id, newValue);
    }
  };

  return (
    <BuffSlider
      slots={{ thumb: BuffThumbComponent }}
      value={value}
      min={range[0]}
      max={range[1]} // Overall minimum value for the slider
      onChange={handleChange}
      onChangeCommitted={handleSlideComplete}
      valueLabelDisplay="auto"
      valueLabelFormat={formatTimestamp}
      disableSwap
    />
  );
};
