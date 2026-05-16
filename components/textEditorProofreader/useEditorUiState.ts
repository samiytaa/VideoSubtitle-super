import { useReducer } from 'react';
import { isDialogueBlock, ModalKey, NarrationType, ParsedBlock, SearchResult } from './types';

type StateUpdater<T> = T | ((prev: T) => T);

interface EditorUiState {
  editingBlockIndex: number | null;
  editingContent: string;
  editingCharacter: string;
  editingAvatar: string;
  editingNarrationType: NarrationType;
  editingChoiceBlockIndex: number | null;
  editingChoiceOptions: { label: string; blocks: ParsedBlock[] }[];
  editingNestedIndex: number | null;
  editingNestedLabel: string;
  nestedSelectedOption: Record<number, number | null>;
  nestedHighlight: { blockIndex: number; showIndex: number; bi?: number } | null;
  editingNestedContent: { groupIndex: number; showIndex: number; bi: number } | null;
  editingNestedBlockContent: string;
  editingNestedBlockCharacter: string;
  editingNestedBlockNarrationType: NarrationType;
  editingNestedBlockAvatar: string;
  editingSubBlock: { optIdx: number; subIdx: number } | null;
  editingSubContent: string;
  editingSubCharacter: string;
  editingSubAvatar: string;
  editingSubNarrationType: NarrationType;
  choiceSelectedOption: Record<number, number | null>;
  editingNestedLabel2: { blockIndex: number; showIndex: number } | null;
  editingNestedLabelValue: string;
  isMultiSelectMode: boolean;
  selectedBlockIndices: Set<number>;
  selectedNestedKeys: Set<string>;
  searchKeyword: string;
  searchResults: SearchResult[];
  selectedCharacterName: string;
  modals: Record<ModalKey, boolean>;
}

type EditorUiAction =
  | { type: 'startBlockEdit'; payload: { blockIndex: number; block: ParsedBlock } }
  | { type: 'cancelBlockEdit' }
  | { type: 'setField'; payload: { key: keyof EditorUiState; value: EditorUiState[keyof EditorUiState] } }
  | { type: 'setModal'; payload: { key: ModalKey; open: boolean } }
  | { type: 'resetEditingScopes' };

const initialEditorUiState: EditorUiState = {
  editingBlockIndex: null,
  editingContent: '',
  editingCharacter: '',
  editingAvatar: '',
  editingNarrationType: 'narration',
  editingChoiceBlockIndex: null,
  editingChoiceOptions: [],
  editingNestedIndex: null,
  editingNestedLabel: '',
  nestedSelectedOption: {},
  nestedHighlight: null,
  editingNestedContent: null,
  editingNestedBlockContent: '',
  editingNestedBlockCharacter: '',
  editingNestedBlockNarrationType: 'narration',
  editingNestedBlockAvatar: '',
  editingSubBlock: null,
  editingSubContent: '',
  editingSubCharacter: '',
  editingSubAvatar: '',
  editingSubNarrationType: 'narration',
  choiceSelectedOption: {},
  editingNestedLabel2: null,
  editingNestedLabelValue: '',
  isMultiSelectMode: false,
  selectedBlockIndices: new Set(),
  selectedNestedKeys: new Set(),
  searchKeyword: '',
  searchResults: [],
  selectedCharacterName: '',
  modals: { avatar: false, nestedAvatar: false, subAvatar: false, batchAvatar: false, search: false, quickReplace: false }
};

const editorUiReducer = (state: EditorUiState, action: EditorUiAction): EditorUiState => {
  switch (action.type) {
    case 'startBlockEdit':
      return {
        ...state,
        editingBlockIndex: action.payload.blockIndex,
        editingContent: action.payload.block.content,
        editingCharacter: isDialogueBlock(action.payload.block) ? action.payload.block.character : '',
        editingAvatar: isDialogueBlock(action.payload.block) ? action.payload.block.avatarStyle : '',
        editingNarrationType: action.payload.block.type === 'narration-thought' ? 'narration-thought' : 'narration'
      };
    case 'cancelBlockEdit':
      return { ...state, editingBlockIndex: null, editingContent: '', editingCharacter: '', editingAvatar: '', editingNarrationType: 'narration', modals: { ...state.modals, avatar: false } };
    case 'setField':
      return { ...state, [action.payload.key]: action.payload.value };
    case 'setModal':
      return { ...state, modals: { ...state.modals, [action.payload.key]: action.payload.open } };
    case 'resetEditingScopes':
      return {
        ...state,
        editingBlockIndex: null,
        editingContent: '',
        editingCharacter: '',
        editingAvatar: '',
        editingNarrationType: 'narration',
        editingChoiceBlockIndex: null,
        editingChoiceOptions: [],
        editingNestedIndex: null,
        editingNestedLabel: '',
        editingNestedContent: null,
        editingNestedBlockContent: '',
        editingNestedBlockCharacter: '',
        editingNestedBlockNarrationType: 'narration',
        editingNestedBlockAvatar: '',
        editingSubBlock: null,
        editingSubContent: '',
        editingSubCharacter: '',
        editingSubAvatar: '',
        editingSubNarrationType: 'narration',
        editingNestedLabel2: null,
        editingNestedLabelValue: '',
        modals: { ...state.modals, avatar: false, nestedAvatar: false, subAvatar: false }
      };
    default:
      return state;
  }
};

export const useEditorUiState = () => {
  const [uiState, dispatch] = useReducer(editorUiReducer, initialEditorUiState);
  const setField = <K extends keyof EditorUiState>(key: K, value: EditorUiState[K]) =>
    dispatch({ type: 'setField', payload: { key, value } });
  const setModal = (key: ModalKey, open: boolean) =>
    dispatch({ type: 'setModal', payload: { key, open } });

  const selectors = {
    showAvatarPicker: uiState.modals.avatar,
    showNestedAvatarPicker: uiState.modals.nestedAvatar,
    showSubAvatarPicker: uiState.modals.subAvatar,
    showBatchAvatarPicker: uiState.modals.batchAvatar,
    showSearchDialog: uiState.modals.search,
    showQuickReplaceDialog: uiState.modals.quickReplace
  };

  const actions = {
    startBlockEdit: (blockIndex: number, block: ParsedBlock) => dispatch({ type: 'startBlockEdit', payload: { blockIndex, block } }),
    cancelBlockEdit: () => dispatch({ type: 'cancelBlockEdit' }),
    resetEditingScopes: () => dispatch({ type: 'resetEditingScopes' }),
    setEditingContent: (value: string) => setField('editingContent', value),
    setEditingCharacter: (value: string) => setField('editingCharacter', value),
    setEditingAvatar: (value: string) => setField('editingAvatar', value),
    setEditingNarrationType: (value: NarrationType) => setField('editingNarrationType', value),
    setEditingChoiceBlockIndex: (value: number | null) => setField('editingChoiceBlockIndex', value),
    setEditingChoiceOptions: (value: { label: string; blocks: ParsedBlock[] }[]) => setField('editingChoiceOptions', value),
    setEditingNestedIndex: (value: number | null) => setField('editingNestedIndex', value),
    setEditingNestedLabel: (value: string) => setField('editingNestedLabel', value),
    setNestedSelectedOption: (value: Record<number, number | null> | ((prev: Record<number, number | null>) => Record<number, number | null>)) =>
      setField('nestedSelectedOption', typeof value === 'function' ? value(uiState.nestedSelectedOption) : value),
    setNestedHighlight: (value: { blockIndex: number; showIndex: number; bi?: number } | null) => setField('nestedHighlight', value),
    setEditingNestedContent: (value: { groupIndex: number; showIndex: number; bi: number } | null) => setField('editingNestedContent', value),
    setEditingNestedBlockContent: (value: string) => setField('editingNestedBlockContent', value),
    setEditingNestedBlockCharacter: (value: string) => setField('editingNestedBlockCharacter', value),
    setEditingNestedBlockNarrationType: (value: NarrationType) => setField('editingNestedBlockNarrationType', value),
    setEditingNestedBlockAvatar: (value: string) => setField('editingNestedBlockAvatar', value),
    setEditingSubBlock: (value: { optIdx: number; subIdx: number } | null) => setField('editingSubBlock', value),
    setEditingSubContent: (value: string) => setField('editingSubContent', value),
    setEditingSubCharacter: (value: string) => setField('editingSubCharacter', value),
    setEditingSubAvatar: (value: string) => setField('editingSubAvatar', value),
    setEditingSubNarrationType: (value: NarrationType) => setField('editingSubNarrationType', value),
    setChoiceSelectedOption: (value: StateUpdater<Record<number, number | null>>) =>
      setField('choiceSelectedOption', typeof value === 'function' ? value(uiState.choiceSelectedOption) : value),
    setEditingNestedLabel2: (value: { blockIndex: number; showIndex: number } | null) => setField('editingNestedLabel2', value),
    setEditingNestedLabelValue: (value: string) => setField('editingNestedLabelValue', value),
    setIsMultiSelectMode: (value: boolean) => setField('isMultiSelectMode', value),
    setSelectedBlockIndices: (value: StateUpdater<Set<number>>) =>
      setField('selectedBlockIndices', typeof value === 'function' ? value(uiState.selectedBlockIndices) : value),
    setSelectedNestedKeys: (value: StateUpdater<Set<string>>) =>
      setField('selectedNestedKeys', typeof value === 'function' ? value(uiState.selectedNestedKeys) : value),
    clearSelections: () => {
      setField('selectedBlockIndices', new Set<number>());
      setField('selectedNestedKeys', new Set<string>());
    },
    setSearchKeyword: (value: string) => setField('searchKeyword', value),
    setSearchResults: (value: SearchResult[]) => setField('searchResults', value),
    setSelectedCharacterName: (value: string) => setField('selectedCharacterName', value),
    setShowAvatarPicker: (open: boolean) => setModal('avatar', open),
    setShowNestedAvatarPicker: (open: boolean) => setModal('nestedAvatar', open),
    setShowSubAvatarPicker: (open: boolean) => setModal('subAvatar', open),
    setShowBatchAvatarPicker: (open: boolean) => setModal('batchAvatar', open),
    setShowSearchDialog: (open: boolean) => setModal('search', open),
    setShowQuickReplaceDialog: (open: boolean) => setModal('quickReplace', open),
    openAvatarModal: (scope: 'avatar' | 'nestedAvatar' | 'subAvatar' | 'batchAvatar') => setModal(scope, true),
    closeAvatarModal: (scope: 'avatar' | 'nestedAvatar' | 'subAvatar' | 'batchAvatar') => setModal(scope, false),
    enterMultiSelect: () => setField('isMultiSelectMode', true),
    exitMultiSelect: () => {
      setField('isMultiSelectMode', false);
      setField('selectedBlockIndices', new Set<number>());
      setField('selectedNestedKeys', new Set<string>());
    }
  };

  return { state: uiState, actions, selectors, ...uiState, ...selectors, ...actions };
};
