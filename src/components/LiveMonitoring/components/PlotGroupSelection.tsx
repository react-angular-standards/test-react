/** @format */

import { useMemo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { MenuItem, Select } from '@mui/material';
import { ThreeBarsIcon, GraphIcon, GrabberIcon } from '@primer/octicons-react';
import { ChannelGroup } from '../types/ConfiguredChannelSchema';
import { customPlotsStyles } from '../../Widgets/CustomStyle';

interface PlotGroup {
  availableChannels: string[];
  bufferTimeWindow: number;
  channelGroups: ChannelGroup[];
  legendStatus: boolean;
  primaryGrpName: string;
  selectedGroup: string | null;
  createNewGroup: () => void;
  deleteGroup: (groupId: string) => void;
  handleDragEnd: (drag: DropResult) => void;
  removeChannelFromGroup: (groupId: string, name: string) => void;
  setBufferTimeWindow: (duration: number) => void;
  setPrimaryGrpName: (name: string) => void;
  setSelectedGroup: (group: string | null) => void;
  toggleChannelSection: () => void;
  toggleChartLagend: () => void;
  updateChartTitle: (grpId: string, name: string) => void;
  updateGroup: (groupId: string, name: string) => void;
}

export const PlotGroupSelection: React.FC<PlotGroup> = (prop) => {
  const timeOptions = useRef<string[]>(['1', '2', '5', '8']);

  const groupColors = useMemo(
    () => [
      'bg-light-blue',
      'bg-light-green',
      'bg-light-yellow',
      'bg-light-pink',
      'bg-light-purple',
      'bg-light-teal',
      'bg-light-orange',
      'bg-light-indigo',
    ],
    []
  );

  return (
    <>
      <style>{customPlotsStyles}</style>
      <div className='channels-section bg-custom-green rounded-lg shadow round-border p-2 pt-0 m-4 mt-1'>
        <div className='dashboard-header pt-3 mb-3'>
          <h6 className='h6 font-weight-bold text-muted' style={{ position: 'absolute' }}>
            Dashboard Settings
          </h6>
          <div className='toggle-icon' onClick={prop.toggleChannelSection} title='Show streaming option'>
            <ThreeBarsIcon size={24} />
          </div>
        </div>
        <div className='mb-5'>
          <div className='d-flex justify-content-between align-items-center mb-3'>
            <div
              onClick={prop.toggleChartLagend}
              className='chip chip-lg chip-blue cursor-pointer shadow-sm no-shrink'>
              <span>Legend-{prop.legendStatus ? 'On' : 'Off'}</span>
            </div>
            <div className='chip chip-blue shadow-sm no-shrink'>
              <span>
                Buffering Range-
                <Select
                  sx={{
                    borderRadius: '9999px',
                    paddingRight: 0,
                    paddingLeft: 1,
                    fontSize: '.6rem',
                    '& .MuiSelect-select.MuiInputBase-input.MuiOutlinedInput-input': {
                      height: '1.5rem',
                      width: '2rem',
                      padding: 0,
                      alignContent: 'center',
                    },
                  }}
                  value={prop.bufferTimeWindow}
                  onChange={(event) => {
                    prop.setBufferTimeWindow(Number(event.target.value));
                  }}>
                  {timeOptions.current.map((option: string) => (
                    <MenuItem className='chip chip-blue' value={option} key={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </span>
            </div>
          </div>

          <DragDropContext onDragEnd={prop.handleDragEnd}>
            <h6 className='h6 font-weight-bold text-muted'>Primary Group</h6>
            <div className='lt-border rounded p-3 mb-3 transition'>
              <span className='text-muted'>
                <GraphIcon size={16} />
                <GrabberIcon size={16} />
                <input
                  className='group-input text-muted'
                  type='text'
                  value={prop.primaryGrpName}
                  onChange={(e) => {
                    prop.setPrimaryGrpName(e.target.value);
                    prop.updateChartTitle('main', e.target.value);
                  }}
                />
              </span>
              <Droppable
                droppableId='available-channels'
                direction='horizontal'
                isDropDisabled={false}
                isCombineEnabled={false}
                ignoreContainerClipping={false}>
                {(provided) => (
                  <div
                    className='d-flex flex-wrap gap-2 p-2 bg-light rounded border m-2'
                    ref={provided.innerRef}
                    {...provided.droppableProps}>
                    {prop.availableChannels.map((channel, index) => (
                      <Draggable
                        key={channel.toString()}
                        draggableId={channel.toString()}
                        index={index}
                        isDragDisabled={false}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className='chip chip-blue cursor-move shadow-sm no-shrink'>
                            {channel.toString()}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {prop.availableChannels.length === 0 && (
                      <span className='text-muted small font-italic'>No channels available</span>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
            <div className='mt-4'>
              <div className='d-flex justify-content-between align-items-center mb-3'>
                <h6 className='h6 font-weight-bold text-muted'>Channel Groups</h6>
                <div
                  onClick={prop.createNewGroup}
                  className='chip chip-blue shadow-sm no-shrink'
                  style={{ cursor: 'pointer' }}>
                  <span className='small'>+</span> New
                </div>
              </div>

              {prop.channelGroups.map((group, index) => (
                <Droppable
                  key={group.id}
                  droppableId={group.id}
                  direction='horizontal'
                  isDropDisabled={false}
                  isCombineEnabled={false}
                  ignoreContainerClipping={false}>
                  {(provided) => (
                    <div
                      className={`border rounded p-3 mb-3 transition ${groupColors[index % groupColors.length]} ${
                        prop.selectedGroup === group.id ? 'shadow-lg' : ''
                      }`}
                      ref={provided.innerRef}
                      {...provided.droppableProps}>
                      <div className='d-flex justify-content-between align-items-center mb-2'>
                        <div
                          className='font-weight-bold text-sm text-dark cursor-pointer'
                          onClick={() => prop.setSelectedGroup(group.id === prop.selectedGroup ? null : group.id)}
                          style={{ transition: 'color 0.2s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#212529')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#343a64')}>
                          <span className='text-muted'>
                            <GraphIcon size={16} />
                            <GrabberIcon size={16} />
                            <input
                              className='group-input text-muted'
                              type='text'
                              value={group.name}
                              onChange={(e) => prop.updateGroup(group.id, e.target.value)}
                            />
                          </span>
                        </div>
                        <div className='d-flex gap-2'>
                          <button
                            onClick={() => prop.deleteGroup(group.id)}
                            className='btn custom-btn btn-outline-danger py-0 px-2'>
                            X
                          </button>
                        </div>
                      </div>
                      <div className='d-flex flex-wrap gap-2 custom-drop-area'>
                        {group.channels.map((channel, index) => (
                          <Draggable
                            key={channel}
                            draggableId={channel.toString()}
                            index={index}
                            isDragDisabled={false}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className='chip chip-green shadow-sm no-shrink'>
                                {channel}
                                <div
                                  onClick={() => prop.removeChannelFromGroup(group.id, channel)}
                                  className='chip chip-red cursor-pointer ml-1 no-shrink'>
                                  ×
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {group.channels.length === 0 && (
                          <div className='text-muted small font-italic text-center'>Drop channels here</div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
              {prop.channelGroups.length === 0 && (
                <div className='text-muted small font-italic text-center py-3'>No groups created yet</div>
              )}
            </div>
          </DragDropContext>
        </div>
      </div>
    </>
  );
};
