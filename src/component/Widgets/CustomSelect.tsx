import React from "react";
import Select, { MultiValue, SingleValue } from "react-select";

interface SelectOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  isMulti: boolean;
  options: any[];
  value: any;
  onChange: (
    newValue: SingleValue<SelectOption> | MultiValue<SelectOption>,
  ) => void;
  placeholder?: string;
  isSearchable?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  isMulti,
  options,
  value,
  onChange,
  placeholder = "Select...",
  isSearchable = true,
}) => {
  return (
    <Select
      isMulti={isMulti}
      options={options}
      value={value}
      onChange={(newValue) => onChange(newValue)}
      placeholder={placeholder}
      isSearchable={isSearchable}
      styles={{
        control: (base) => ({
          ...base,
          fontSize: "0.75rem",
          minHeight: "32px",
        }),
        menu: (base) => ({
          ...base,
          fontSize: "0.75rem",
        }),
      }}
    />
  );
};

export default CustomSelect;
