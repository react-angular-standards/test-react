/** @format */

import React, { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { useLiveMonitoringContext } from "../context/LiveMonitorContext";
import { Option } from "../types/ConfiguredChannelSchema";
import { fetchConfiguredChannels } from "../utils/fetchConfiguredChannels";
import { useAuth } from "../../../AuthProvider";

const animatedComponents = makeAnimated();
const customStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: "28px",
    fontSize: "12px",
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    fontSize: "12px",
    padding: state.data.isCard ? "6px 8px" : "4px 8px 4px 24px",
    backgroundColor: state.data.isSelectAll
      ? "#f0f9ff"
      : provided.backgroundColor,
    fontWeight: state.data.isCard ? 600 : 400,
  }),
  groupHeading: (provided: any) => ({
    ...provided,
    fontSize: "12px",
    fontWeight: 600,
    color: "#1976d2",
    padding: "8px",
  }),
  multiValue: (provided: any) => ({
    ...provided,
    backgroundColor: "#e3f2fd",
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    fontSize: "11px",
    color: "#1976d2",
  }),
  multiValueRemove: (provided: any) => ({
    ...provided,
    color: "#1976d2",
    ":hover": {
      backgroundColor: "#d0e4f7",
      color: "#1976d2",
    },
  }),
};

interface CascadingMultiSelectProps {
  onChannelSelect?: (channels: string[]) => void;
  onRecordCall: () => void;
  connectionStatus: string;
}

const CascadingMultiSelect: React.FC<CascadingMultiSelectProps> = ({
  onChannelSelect,
  onRecordCall,
  connectionStatus,
}) => {
  const {
    activePlotChannelsRef,
    activeDiscreteChannelsRef,
    channelIdToPlotInfoRef,
    isRecording,
    isStreaming,
    setAvailableChannels,
    setIsStreaming,
    sendDynamicChannelRequest,
  } = useLiveMonitoringContext();
  const { session } = useAuth();
  const isUpdateRecordingRequired = true;
  const [loading, setLoading] = useState(true);
  const [isChannelListChanged, setIsChannelListChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableOptionListToSelect, setAvailableOptionListToSelect] =
    useState<Option[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Option[]>([]);

  const cleanUpSelectedChannels = useCallback(
    (optionListToMatch: Option[]) => {
      let changesDetected = false;
      if (connectionStatus !== "Off") {
        const channelList = Object.keys(activePlotChannelsRef.current);
        console.log("channelList", channelList);

        channelList.forEach((channelId) => {
          // Extract numeric ID from options to match against activePlotChannelsRef keys
          if (
            !optionListToMatch.some(
              (option) => option.value.split(" - ")[0] === channelId,
            )
          ) {
            delete activePlotChannelsRef.current[channelId];
            delete channelIdToPlotInfoRef.current[channelId];
            changesDetected = true;
          }
        });

        setSelectedOptions(Object.values(channelIdToPlotInfoRef.current));
      } else {
        setSelectedOptions([]);
      }
      setIsChannelListChanged(changesDetected);
    },
    [
      setSelectedOptions,
      connectionStatus,
      activePlotChannelsRef,
      channelIdToPlotInfoRef,
    ],
  );

  const updateChannelsToPlot = useCallback(
    (availableOpt: Option) => {
      // Skip if no channelName (e.g., Select All options)
      if (!availableOpt.channelName) {
        console.warn("Skipping option without channelName:", availableOpt);
        return;
      }

      // Extract numeric ID from "channelId - channelName" format for WebSocket
      const numericId = availableOpt.value.split(" - ")[0];

      channelIdToPlotInfoRef.current[numericId] = {
        yAxisIndex: 0,
        value: availableOpt.value,
        label: availableOpt.label,
        channelName: availableOpt.channelName,
      };
    },
    [channelIdToPlotInfoRef],
  );

  const handleChannelChange = (selected: readonly Option[]) => {
    console.log("handleChannelChange", selected);

    const tmpSelected = [...selected];
    const newSelectedChannels: Option[] = [];
    let changesDetected = false;

    tmpSelected.forEach((opt) => {
      if (opt.isSelectAll) {
        availableOptionListToSelect.forEach((availableOpt: Option) => {
          console.log("availableOpt", availableOpt);

          if (
            availableOpt.cardId === opt.cardId &&
            !availableOpt.isSelectAll &&
            !availableOpt.isCard
          ) {
            newSelectedChannels.push(availableOpt);
            changesDetected = true;
          }
        });
      } else {
        console.log("opt", opt);
        newSelectedChannels.push(opt);
        changesDetected = true;
      }
    });
    setIsChannelListChanged(changesDetected);
    setSelectedOptions(
      newSelectedChannels.sort((c1, c2) => c1.label.localeCompare(c2.label)),
    );
  };

  const handleStreamButtonClick = useCallback(() => {
    selectedOptions.forEach((opt) => {
      updateChannelsToPlot(opt);
    });
    cleanUpSelectedChannels(selectedOptions);

    if (onChannelSelect) {
      // Pass the full "id - name" format for display purposes
      const channelValues = Object.values(channelIdToPlotInfoRef.current).map(
        (opt) => opt.value,
      );
      onChannelSelect(channelValues);
    }
    setIsStreaming(true);
    setIsChannelListChanged(false);
    sendDynamicChannelRequest(session?.name || "Invalid User");
  }, [
    selectedOptions,
    updateChannelsToPlot,
    cleanUpSelectedChannels,
    onChannelSelect,
    channelIdToPlotInfoRef,
    setIsStreaming,
    sendDynamicChannelRequest,
    session,
  ]);

  useEffect(() => {
    fetchConfiguredChannels(
      setLoading,
      setError,
      setAvailableOptionListToSelect,
    );
  }, []);

  useEffect(() => {
    console.log("availableOptionListToSelect ", availableOptionListToSelect);
    console.log("connectionStatus ", connectionStatus);
    if (!loading) {
      cleanUpSelectedChannels(availableOptionListToSelect);
    }
  }, [loading, availableOptionListToSelect, cleanUpSelectedChannels]);

  // Reset everything when connection is turned Off
  useEffect(() => {
    if (connectionStatus === "Off") {
      setSelectedOptions([]);
      setAvailableChannels([]);
      activeDiscreteChannelsRef.current = {};
      activePlotChannelsRef.current = {};
      channelIdToPlotInfoRef.current = {};
    }
  }, [
    connectionStatus,
    setAvailableChannels,
    activeDiscreteChannelsRef,
    activePlotChannelsRef,
    channelIdToPlotInfoRef,
  ]);

  if (loading) return <div className="text-center p-4">Loading...</div>;
  if (error)
    return <div className="text-center p-4 text-danger">Error: {error}</div>;

  return (
    <div className="align-items-center" style={{ display: "contents" }}>
      <div
        className="col-md-6 align-items-center"
        style={{ display: "contents", minWidth: "250px", width: "100%" }}
      >
        <div className="container-fluid col-sm-12 px-1 mt-2 mb-2">
          <label className="form-label">Select Channels</label>
          <Select
            isMulti
            closeMenuOnSelect={false}
            components={animatedComponents}
            options={availableOptionListToSelect}
            value={selectedOptions}
            onChange={handleChannelChange as any}
            styles={customStyles}
            placeholder={
              loading
                ? "Loading channels..."
                : error
                  ? "Error loading channels"
                  : connectionStatus === "Off"
                    ? "Switch connection"
                    : "Select channels"
            }
            classNamePrefix="select"
            isDisabled={!!error || connectionStatus === "Off"}
          />
        </div>
      </div>
      <div className="col-md-12 mt-2 d-flex align-items-center justify-content-end">
        <button
          onClick={handleStreamButtonClick}
          disabled={
            connectionStatus === "Off" || (isStreaming && !isChannelListChanged)
          }
          className={`btn btn-sm me-2 ${
            connectionStatus === "Off" || (isStreaming && !isChannelListChanged)
              ? "btn-secondary disabled"
              : isStreaming
                ? "btn-warning"
                : "btn-danger"
          }`}
          style={{
            cursor:
              connectionStatus === "Off" ||
              (isStreaming && !isChannelListChanged)
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isStreaming
            ? isChannelListChanged
              ? "Update Stream"
              : "Stream Data"
            : "Stream Data"}
        </button>

        <button
          onClick={onRecordCall}
          disabled={connectionStatus === "Off" || !isStreaming}
          className={`btn btn-sm ${
            connectionStatus === "Off" || !isStreaming
              ? "btn-secondary disabled"
              : isStreaming
                ? "btn-warning"
                : "btn-danger"
          }`}
          style={{
            cursor:
              connectionStatus === "Off" || !isStreaming
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isStreaming && isRecording
            ? isUpdateRecordingRequired
              ? "Update Recording"
              : "Stop Recording"
            : "Record Stream"}
        </button>
      </div>
    </div>
  );
};

export default CascadingMultiSelect;
