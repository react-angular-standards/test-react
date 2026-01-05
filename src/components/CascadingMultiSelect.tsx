import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Form, Card } from 'react-bootstrap';
import styled from 'styled-components';

// Define interfaces for our types
interface Option {
    value: string | number;
    label: string;
    chassisId?: number;
    cardId?: number;
}

// API Data Interfaces
interface Channel {
    id: number;
    NAME: string;
    type: string;
    Channel_number: string;
    Range_Min: string;
    Range_Max: string;
    Excitation: string;
    children: [];
}

interface CardData {
    id: number;
    NAME: string;
    type: string;
    ModuleType: string;
    No_ch: string;
    Task_id: string;
    children: Channel[];
}

interface Chassis {
    id: number;
    NAME: string;
    type: string;
    system_id: string;
    children: CardData[];
}

interface ApiResponse {
    children: Chassis[];
}

interface SearchableMultiSelectProps {
    options: Option[];
    selectedValues: (string | number)[];
    onChange: (values: (string | number)[]) => void;
    placeholder: string;
    label: string;
    disabled?: boolean;
}

const SelectWrapper = styled.div`
  .dropdown-container {
    border: 1px solid #dee2e6;
    border-radius: 3px;
    background: white;
    min-height: 28px;
    cursor: pointer;
    font-size: 12px;
    &.disabled {
      background: #e9ecef;
      cursor: not-allowed;
    }
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 1px;
    padding: 1px;
  }

  .tag {
    background: #e3f2fd;
    color: #1976d2;
    padding: 0px 4px;
    border-radius: 2px;
    font-size: 11px;
  }

  .dropdown-menu {
    width: 100%;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    margin-top: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    background: white;
    z-index: 1000;
    position: absolute;
  }

  .search-input {
    padding: 4px;
    input {
      width: 100%;
      padding: 2px 6px;
      border: 1px solid #dee2e6;
      border-radius: 3px;
      font-size: 12px;
    }
  }

  .options-container {
    max-height: 150px;
    overflow-y: auto;
  }

  .option-item {
    padding: 4px 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    &:hover {
      background: #f8f9fa;
    }
    &.selected {
      background: #e3f2fd;
    }
  }
`;

const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
    options,
    selectedValues,
    onChange,
    placeholder,
    disabled = false,
    label
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabels = options
        .filter(opt => selectedValues.includes(opt.value))
        .map(opt => opt.label);

    return (
        <SelectWrapper ref={dropdownRef}>
            <Form.Label>{label}</Form.Label>
            <div
                className={`dropdown-container ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="d-flex align-items-center p-2">
                    <div className="flex-grow-1">
                        {selectedLabels.length > 0 ? (
                            <div className="selected-tags">
                                {selectedLabels.map((label, index) => (
                                    <span key={index} className="tag">{label}</span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-muted">{placeholder}</span>
                        )}
                    </div>
                    <Search size={16} className="text-muted" />
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="dropdown-menu show">
                    <div className="search-input">
                        <Form.Control
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="options-container">
                        <div
                            className="option-item"
                            onClick={() => {
                                onChange(filteredOptions.map(opt => opt.value));
                                setSearchTerm('');
                            }}
                        >
                            Select All Filtered
                        </div>
                        <div
                            className="option-item border-bottom"
                            onClick={() => {
                                onChange([]);
                                setSearchTerm('');
                            }}
                        >
                            Clear All
                        </div>
                        {filteredOptions.map((option) => (
                            <div
                                key={option.value}
                                className={`option-item ${selectedValues.includes(option.value) ? 'selected' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newValues = selectedValues.includes(option.value)
                                        ? selectedValues.filter(v => v !== option.value)
                                        : [...selectedValues, option.value];
                                    onChange(newValues);
                                }}
                            >
                                <Form.Check
                                    type="checkbox"
                                    checked={selectedValues.includes(option.value)}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        e.stopPropagation();
                                        const newValues = selectedValues.includes(option.value)
                                            ? selectedValues.filter(v => v !== option.value)
                                            : [...selectedValues, option.value];
                                        onChange(newValues);
                                    }}
                                    label={option.label}
                                />
                            </div>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="text-center text-muted p-2">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </SelectWrapper>
    );
};

const CascadingMultiSelect: React.FC = () => {
    const [hierarchyData, setHierarchyData] = useState<Chassis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedChassis, setSelectedChassis] = useState<number[]>([]);
    const [selectedCards, setSelectedCards] = useState<number[]>([]);
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('https://asitdasservice.taspre-phx-mtls.apps.boeing.com/api/acmeservice/querydshierarchy/138/Test01');
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                const data: ApiResponse = await response.json();
                setHierarchyData(data.children || []);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <div className="text-center p-4">Loading...</div>;
    }

    if (error) {
        return <div className="text-center p-4 text-danger">Error: {error}</div>;
    }

    const chassisOptions: Option[] = hierarchyData.map(chassis => ({
        value: chassis.id,
        label: chassis.NAME
    }));

    const getCardOptions = (): Option[] => {
        if (selectedChassis.length === 0) return [];
        return hierarchyData
            .filter(c => selectedChassis.includes(c.id))
            .flatMap(chassis => chassis.children.map(card => ({
                value: card.id,
                label: `${chassis.NAME} - ${card.NAME}`,
                chassisId: chassis.id
            })));
    };

    const getChannelOptions = (): Option[] => {
        if (selectedCards.length === 0) return [];
        return hierarchyData
            .filter(c => selectedChassis.includes(c.id))
            .flatMap(chassis =>
                chassis.children
                    .filter(card => selectedCards.includes(card.id))
                    .flatMap(card => card.children.map(channel => ({
                        value: channel.Channel_number,
                        label: `${chassis.NAME} - ${card.NAME} - Channel ${channel.Channel_number}`,
                        cardId: card.id,
                        chassisId: chassis.id
                    })))
            );
    };

    return (
        <div className="container-fluid" style={{ paddingTop: '60px' }}>
            <div className="row mb-3">
                <div className="col-sm-4 px-1">
                    <SearchableMultiSelect
                        label="Select Chassis"
                        options={chassisOptions}
                        selectedValues={selectedChassis}
                        onChange={(values) => setSelectedChassis(values.map(Number))}
                        placeholder="Select chassis"
                    />
                </div>
                <div className="col-sm-4 px-1">
                    <SearchableMultiSelect
                        label="Select Cards"
                        options={getCardOptions()}
                        selectedValues={selectedCards}
                        onChange={(values) => setSelectedCards(values.map(Number))}
                        placeholder="Select cards"
                        disabled={selectedChassis.length === 0}
                    />
                </div>
                <div className="col-sm-4 px-1">
                    <SearchableMultiSelect
                        label="Select Channels"
                        options={getChannelOptions()}
                        selectedValues={selectedChannels}
                        onChange={(values) => setSelectedChannels(values.map(String))}
                        placeholder="Select channels"
                        disabled={selectedCards.length === 0}
                    />
                </div>
            </div>

            <Card className="bg-light">
                <Card.Body>
                    <h6 className="mb-3">Current Selection:</h6>
                    <div className="row">
                        <div className="col-sm-4 mb-2">
                            <strong>Chassis:</strong>
                            <div className="selected-tags mt-1">
                                {selectedChassis.map(id => (
                                    <span key={id} className="tag">
                                        {chassisOptions.find(c => c.value === id)?.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="col-sm-4 mb-2">
                            <strong>Cards:</strong>
                            <div className="selected-tags mt-1">
                                {selectedCards.map(id => (
                                    <span key={id} className="tag">
                                        {getCardOptions().find(c => c.value === id)?.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="col-sm-4">
                            <strong>Channels:</strong>
                            <div className="selected-tags mt-1">
                                {selectedChannels.map(channel => (
                                    <span key={channel} className="tag">
                                        {getChannelOptions().find(c => c.value === channel)?.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card.Body>
            </Card>

            {/* XML Output */}
            <Card className="bg-light mt-3">
                <Card.Body>
                    <h6 className="mb-3">XML Format:</h6>
                    <pre className="border rounded bg-white p-3" style={{ fontSize: '12px' }}>
                        {`<?xml version="1.0" encoding="UTF-8"?>
<selections>
    <chassis>
${selectedChassis.map(id => {
                            const chassis = hierarchyData.find(c => c.id === id);
                            return `        <chassis_item id="${id}" name="${chassis?.NAME}">
            <cards>
${selectedCards
                                    .filter(cardId => {
                                        const card = getCardOptions().find(c => c.value === cardId);
                                        return card?.chassisId === id;
                                    })
                                    .map(cardId => {
                                        const card = getCardOptions().find(c => c.value === cardId);
                                        return `                <card_item id="${cardId}" name="${card?.label?.split(' - ')[1]}">
                    <channels>
${selectedChannels
                                                .filter(channel => {
                                                    const channelOption = getChannelOptions().find(c => c.value === channel);
                                                    return channelOption?.cardId === cardId;
                                                })
                                                .map(channel => `                        <channel_item>${channel}</channel_item>`).join('\n')}
                    </channels>
                </card_item>`;
                                    }).join('\n')}
            </cards>
        </chassis_item>`;
                        }).join('\n')}
    </chassis>
</selections>`}
                    </pre>
                </Card.Body>
            </Card>
        </div>
    );
};

export default CascadingMultiSelect;