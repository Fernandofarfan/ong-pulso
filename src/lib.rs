#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String, Vec,
};

const VERSION: u32 = 1;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Draft,
    Active,
    Paused,
    Cancelled,
    Completed,
    Archived,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Rejected,
    Completed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Factory,
    Funder,
    Grantee,
    Arbiter,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Action {
    Activate,
    Pause,
    Resume,
    Cancel,
    Complete,
    Archive,
    SubmitMilestone,
    ApproveMilestone,
    RejectMilestone,
    CompleteMilestone,
    UpdateMetadata,
    TransferRole,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Agreement {
    pub status: Status,
    pub factory: Address,
    pub funder: Address,
    pub grantee: Address,
    pub arbiter: Address,
    pub metadata_uri: String,
    pub milestone_count: u32,
    pub created_at: u64,
    pub updated_at: u64,
    pub completed_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgreementConfig {
    pub version: u32,
    pub settlement_adapter: Address,
    pub allow_partial_completion: bool,
    pub requires_all_milestones: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Participants {
    pub factory: Address,
    pub funder: Address,
    pub grantee: Address,
    pub arbiter: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub id: u32,
    pub status: MilestoneStatus,
    pub amount: i128,
    pub metadata_uri: String,
    pub completed_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Agreement,
    Config,
    Milestone(u32),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidState = 4,
    MilestoneNotFound = 5,
    InvalidMilestoneState = 6,
    InvalidRole = 7,
    InvalidAmount = 8,
    InvalidMetadataUri = 9,
}

#[contractevent(topics = ["initialized"])]
pub struct InitializedEvent {
    pub milestone_count: u32,
}

#[contractevent(topics = ["status_changed"])]
pub struct StatusChangedEvent {
    pub status: Status,
}

#[contractevent(topics = ["milestone_changed"])]
pub struct MilestoneChangedEvent {
    pub id: u32,
    pub status: MilestoneStatus,
}

#[contractevent(topics = ["metadata_updated"])]
pub struct MetadataUpdatedEvent {
    pub metadata_uri: String,
}

#[contractevent(topics = ["role_transferred"])]
pub struct RoleTransferredEvent {
    pub role: Role,
    pub address: Address,
}

#[contract]
pub struct FundingAgreement;

#[contractimpl]
impl FundingAgreement {
    pub fn initialize(
        env: Env,
        factory: Address,
        funder: Address,
        grantee: Address,
        arbiter: Address,
        metadata_uri: String,
        config: AgreementConfig,
        milestones: Vec<(i128, String)>,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&StorageKey::Agreement) {
            return Err(ContractError::AlreadyInitialized);
        }

        factory.require_auth();
        validate_metadata_uri(&metadata_uri)?;

        let milestone_count = milestones.len();
        for id in 0..milestone_count {
            let (amount, metadata_uri) = milestones.get(id).unwrap();
            if amount <= 0 {
                return Err(ContractError::InvalidAmount);
            }
            validate_metadata_uri(&metadata_uri)?;

            write_milestone(
                &env,
                &Milestone {
                    id,
                    status: MilestoneStatus::Pending,
                    amount,
                    metadata_uri,
                    completed_at: None,
                },
            );
        }

        let now = env.ledger().timestamp();
        let agreement = Agreement {
            status: Status::Draft,
            factory,
            funder,
            grantee,
            arbiter,
            metadata_uri,
            milestone_count,
            created_at: now,
            updated_at: now,
            completed_at: None,
        };

        env.storage().instance().set(&StorageKey::Config, &config);
        write_agreement(&env, &agreement);
        InitializedEvent { milestone_count }.publish(&env);

        Ok(())
    }

    pub fn get_agreement(env: Env) -> Result<Agreement, ContractError> {
        read_agreement(&env)
    }

    pub fn get_config(env: Env) -> Result<AgreementConfig, ContractError> {
        read_config(&env)
    }

    pub fn get_status(env: Env) -> Result<Status, ContractError> {
        Ok(read_agreement(&env)?.status)
    }

    pub fn get_milestones(env: Env) -> Result<Vec<Milestone>, ContractError> {
        let agreement = read_agreement(&env)?;
        let mut milestones = Vec::new(&env);

        for id in 0..agreement.milestone_count {
            milestones.push_back(read_milestone(&env, id)?);
        }

        Ok(milestones)
    }

    pub fn get_milestone(env: Env, id: u32) -> Result<Milestone, ContractError> {
        read_milestone(&env, id)
    }

    pub fn get_participants(env: Env) -> Result<Participants, ContractError> {
        let agreement = read_agreement(&env)?;
        Ok(Participants {
            factory: agreement.factory,
            funder: agreement.funder,
            grantee: agreement.grantee,
            arbiter: agreement.arbiter,
        })
    }

    pub fn get_metadata(env: Env) -> Result<String, ContractError> {
        Ok(read_agreement(&env)?.metadata_uri)
    }

    pub fn get_version() -> u32 {
        VERSION
    }

    pub fn activate(env: Env) -> Result<(), ContractError> {
        require_role(&env, Role::Funder)?;
        set_status(&env, Status::Draft, Status::Active)
    }

    pub fn pause(env: Env) -> Result<(), ContractError> {
        require_role(&env, Role::Funder)?;
        set_status(&env, Status::Active, Status::Paused)
    }

    pub fn resume(env: Env) -> Result<(), ContractError> {
        require_role(&env, Role::Funder)?;
        set_status(&env, Status::Paused, Status::Active)
    }

    pub fn cancel(env: Env) -> Result<(), ContractError> {
        require_role(&env, Role::Funder)?;
        let mut agreement = read_agreement(&env)?;
        if agreement.status == Status::Completed || agreement.status == Status::Archived {
            return Err(ContractError::InvalidState);
        }

        agreement.status = Status::Cancelled;
        touch_agreement(&env, &mut agreement);
        write_agreement(&env, &agreement);
        StatusChangedEvent {
            status: Status::Cancelled,
        }
        .publish(&env);
        Ok(())
    }

    pub fn complete(env: Env) -> Result<(), ContractError> {
        require_role(&env, Role::Arbiter)?;
        let config = read_config(&env)?;
        let mut agreement = read_agreement(&env)?;
        if agreement.status != Status::Active {
            return Err(ContractError::InvalidState);
        }

        if config.requires_all_milestones {
            for id in 0..agreement.milestone_count {
                if read_milestone(&env, id)?.status != MilestoneStatus::Completed {
                    return Err(ContractError::InvalidMilestoneState);
                }
            }
        }

        let now = env.ledger().timestamp();
        agreement.status = Status::Completed;
        agreement.updated_at = now;
        agreement.completed_at = Some(now);
        write_agreement(&env, &agreement);
        StatusChangedEvent {
            status: Status::Completed,
        }
        .publish(&env);
        Ok(())
    }

    pub fn archive(env: Env) -> Result<(), ContractError> {
        require_role(&env, Role::Funder)?;
        set_status(&env, Status::Completed, Status::Archived)
    }

    pub fn submit_milestone(env: Env, id: u32) -> Result<(), ContractError> {
        require_active(&env)?;
        require_role(&env, Role::Grantee)?;
        update_milestone_status(
            &env,
            id,
            MilestoneStatus::Pending,
            MilestoneStatus::Submitted,
        )
    }

    pub fn approve_milestone(env: Env, id: u32) -> Result<(), ContractError> {
        require_active(&env)?;
        require_role(&env, Role::Arbiter)?;
        update_milestone_status(
            &env,
            id,
            MilestoneStatus::Submitted,
            MilestoneStatus::Approved,
        )
    }

    pub fn reject_milestone(env: Env, id: u32) -> Result<(), ContractError> {
        require_active(&env)?;
        require_role(&env, Role::Arbiter)?;
        update_milestone_status(
            &env,
            id,
            MilestoneStatus::Submitted,
            MilestoneStatus::Rejected,
        )
    }

    pub fn complete_milestone(env: Env, id: u32) -> Result<(), ContractError> {
        require_active(&env)?;
        require_role(&env, Role::Arbiter)?;
        update_milestone_status(
            &env,
            id,
            MilestoneStatus::Approved,
            MilestoneStatus::Completed,
        )
    }

    pub fn update_metadata(env: Env, metadata_uri: String) -> Result<(), ContractError> {
        require_role(&env, Role::Funder)?;
        validate_metadata_uri(&metadata_uri)?;

        let mut agreement = read_agreement(&env)?;
        agreement.metadata_uri = metadata_uri.clone();
        touch_agreement(&env, &mut agreement);
        write_agreement(&env, &agreement);

        MetadataUpdatedEvent { metadata_uri }.publish(&env);
        Ok(())
    }

    pub fn transfer_role(env: Env, role: Role, new_address: Address) -> Result<(), ContractError> {
        if role == Role::Factory {
            return Err(ContractError::InvalidRole);
        }

        require_role(&env, role.clone())?;

        let mut agreement = read_agreement(&env)?;
        match role {
            Role::Funder => agreement.funder = new_address.clone(),
            Role::Grantee => agreement.grantee = new_address.clone(),
            Role::Arbiter => agreement.arbiter = new_address.clone(),
            Role::Factory => return Err(ContractError::InvalidRole),
        }

        touch_agreement(&env, &mut agreement);
        write_agreement(&env, &agreement);
        RoleTransferredEvent {
            role,
            address: new_address,
        }
        .publish(&env);
        Ok(())
    }

    pub fn has_role(env: Env, address: Address, role: Role) -> Result<bool, ContractError> {
        let agreement = read_agreement(&env)?;
        Ok(address_for_role(&agreement, role)? == address)
    }

    pub fn can_execute(env: Env, action: Action, address: Address) -> Result<bool, ContractError> {
        let agreement = read_agreement(&env)?;
        Ok(match action {
            Action::Activate
            | Action::Pause
            | Action::Resume
            | Action::Cancel
            | Action::Archive
            | Action::UpdateMetadata => agreement.funder == address,
            Action::SubmitMilestone => agreement.grantee == address,
            Action::Complete
            | Action::ApproveMilestone
            | Action::RejectMilestone
            | Action::CompleteMilestone => agreement.arbiter == address,
            Action::TransferRole => {
                agreement.funder == address
                    || agreement.grantee == address
                    || agreement.arbiter == address
            }
        })
    }

    pub fn contract_version() -> u32 {
        VERSION
    }
}

fn read_agreement(env: &Env) -> Result<Agreement, ContractError> {
    env.storage()
        .instance()
        .get(&StorageKey::Agreement)
        .ok_or(ContractError::NotInitialized)
}

fn write_agreement(env: &Env, agreement: &Agreement) {
    env.storage()
        .instance()
        .set(&StorageKey::Agreement, agreement);
}

fn read_config(env: &Env) -> Result<AgreementConfig, ContractError> {
    env.storage()
        .instance()
        .get(&StorageKey::Config)
        .ok_or(ContractError::NotInitialized)
}

fn read_milestone(env: &Env, id: u32) -> Result<Milestone, ContractError> {
    env.storage()
        .instance()
        .get(&StorageKey::Milestone(id))
        .ok_or(ContractError::MilestoneNotFound)
}

fn write_milestone(env: &Env, milestone: &Milestone) {
    env.storage()
        .instance()
        .set(&StorageKey::Milestone(milestone.id), milestone);
}

fn address_for_role(agreement: &Agreement, role: Role) -> Result<Address, ContractError> {
    match role {
        Role::Factory => Ok(agreement.factory.clone()),
        Role::Funder => Ok(agreement.funder.clone()),
        Role::Grantee => Ok(agreement.grantee.clone()),
        Role::Arbiter => Ok(agreement.arbiter.clone()),
    }
}

fn require_role(env: &Env, role: Role) -> Result<(), ContractError> {
    let agreement = read_agreement(env)?;
    address_for_role(&agreement, role)?.require_auth();
    Ok(())
}

fn require_active(env: &Env) -> Result<(), ContractError> {
    if read_agreement(env)?.status != Status::Active {
        return Err(ContractError::InvalidState);
    }

    Ok(())
}

fn set_status(env: &Env, expected: Status, next: Status) -> Result<(), ContractError> {
    let mut agreement = read_agreement(env)?;
    if agreement.status != expected {
        return Err(ContractError::InvalidState);
    }

    agreement.status = next.clone();
    touch_agreement(env, &mut agreement);
    write_agreement(env, &agreement);
    StatusChangedEvent { status: next }.publish(env);
    Ok(())
}

fn update_milestone_status(
    env: &Env,
    id: u32,
    expected: MilestoneStatus,
    next: MilestoneStatus,
) -> Result<(), ContractError> {
    let mut milestone = read_milestone(env, id)?;
    if milestone.status != expected {
        return Err(ContractError::InvalidMilestoneState);
    }

    milestone.status = next.clone();
    if next == MilestoneStatus::Completed {
        milestone.completed_at = Some(env.ledger().timestamp());
    }
    write_milestone(env, &milestone);

    let mut agreement = read_agreement(env)?;
    touch_agreement(env, &mut agreement);
    write_agreement(env, &agreement);

    MilestoneChangedEvent { id, status: next }.publish(env);
    Ok(())
}

fn touch_agreement(env: &Env, agreement: &mut Agreement) {
    agreement.updated_at = env.ledger().timestamp();
}

fn validate_metadata_uri(metadata_uri: &String) -> Result<(), ContractError> {
    if metadata_uri.len() == 0 {
        return Err(ContractError::InvalidMetadataUri);
    }

    Ok(())
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        vec,
    };

    fn setup(
        env: &Env,
    ) -> (
        FundingAgreementClient<'_>,
        Address,
        Address,
        Address,
        Address,
    ) {
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_000;
        });

        let contract_id = env.register(FundingAgreement, ());
        let client = FundingAgreementClient::new(env, &contract_id);
        let factory = Address::generate(env);
        let funder = Address::generate(env);
        let grantee = Address::generate(env);
        let arbiter = Address::generate(env);
        let settlement_adapter = Address::generate(env);
        let config = AgreementConfig {
            version: VERSION,
            settlement_adapter,
            allow_partial_completion: false,
            requires_all_milestones: true,
        };
        let milestones = vec![
            env,
            (100_i128, String::from_str(env, "ipfs://milestone-0")),
            (250_i128, String::from_str(env, "ipfs://milestone-1")),
        ];

        client.initialize(
            &factory,
            &funder,
            &grantee,
            &arbiter,
            &String::from_str(env, "ipfs://agreement"),
            &config,
            &milestones,
        );

        (client, factory, funder, grantee, arbiter)
    }

    #[test]
    fn initializes_canonical_storage_model() {
        let env = Env::default();
        let (client, factory, funder, grantee, arbiter) = setup(&env);

        let agreement = client.get_agreement();
        assert_eq!(client.get_version(), VERSION);
        assert_eq!(client.contract_version(), VERSION);
        assert_eq!(client.get_status(), Status::Draft);
        assert_eq!(
            client.get_metadata(),
            String::from_str(&env, "ipfs://agreement")
        );
        assert_eq!(agreement.milestone_count, 2);
        assert_eq!(agreement.created_at, 1_700_000_000);
        assert_eq!(agreement.updated_at, 1_700_000_000);
        assert_eq!(agreement.completed_at, None);
        assert_eq!(client.get_config().version, VERSION);
        assert_eq!(client.get_milestones().len(), 2);
        assert!(client.has_role(&factory, &Role::Factory));
        assert!(client.has_role(&funder, &Role::Funder));
        assert!(client.has_role(&grantee, &Role::Grantee));
        assert!(client.has_role(&arbiter, &Role::Arbiter));
    }

    #[test]
    fn progresses_milestone_lifecycle_and_timestamps_completion() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        client.activate();
        client.submit_milestone(&0);
        client.approve_milestone(&0);
        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_100;
        });
        client.complete_milestone(&0);

        let milestone = client.get_milestone(&0);
        assert_eq!(milestone.status, MilestoneStatus::Completed);
        assert_eq!(milestone.completed_at, Some(1_700_000_100));
    }

    #[test]
    fn updates_metadata_uri_without_separate_metadata_entry() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_200;
        });
        client.update_metadata(&String::from_str(&env, "ar://agreement-v2"));

        let agreement = client.get_agreement();
        assert_eq!(
            agreement.metadata_uri,
            String::from_str(&env, "ar://agreement-v2")
        );
        assert_eq!(agreement.updated_at, 1_700_000_200);
    }

    #[test]
    fn completes_and_archives_agreement_after_all_milestones_complete() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        client.activate();
        for id in 0..2 {
            client.submit_milestone(&id);
            client.approve_milestone(&id);
            client.complete_milestone(&id);
        }

        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_300;
        });
        client.complete();
        assert_eq!(client.get_status(), Status::Completed);
        assert_eq!(client.get_agreement().completed_at, Some(1_700_000_300));

        client.archive();
        assert_eq!(client.get_status(), Status::Archived);
    }

    #[test]
    fn rejects_double_initialization() {
        let env = Env::default();
        let (client, factory, funder, grantee, arbiter) = setup(&env);

        let config = client.get_config();
        let result = client.try_initialize(
            &factory,
            &funder,
            &grantee,
            &arbiter,
            &String::from_str(&env, "ipfs://again"),
            &config,
            &vec![&env, (1_i128, String::from_str(&env, "ipfs://m"))],
        );
        assert_eq!(result, Err(Ok(ContractError::AlreadyInitialized)));
    }

    #[test]
    fn rejects_non_positive_milestone_amounts() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_000;
        });

        let contract_id = env.register(FundingAgreement, ());
        let client = FundingAgreementClient::new(&env, &contract_id);
        let config = AgreementConfig {
            version: VERSION,
            settlement_adapter: Address::generate(&env),
            allow_partial_completion: false,
            requires_all_milestones: true,
        };

        let result = client.try_initialize(
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &String::from_str(&env, "ipfs://a"),
            &config,
            &vec![&env, (0_i128, String::from_str(&env, "ipfs://m"))],
        );
        assert_eq!(result, Err(Ok(ContractError::InvalidAmount)));
    }

    #[test]
    fn rejects_empty_metadata_uri() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| {
            ledger.timestamp = 1_700_000_000;
        });

        let contract_id = env.register(FundingAgreement, ());
        let client = FundingAgreementClient::new(&env, &contract_id);
        let config = AgreementConfig {
            version: VERSION,
            settlement_adapter: Address::generate(&env),
            allow_partial_completion: false,
            requires_all_milestones: true,
        };

        let result = client.try_initialize(
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &Address::generate(&env),
            &String::from_str(&env, ""),
            &config,
            &vec![&env, (1_i128, String::from_str(&env, "ipfs://m"))],
        );
        assert_eq!(result, Err(Ok(ContractError::InvalidMetadataUri)));
    }

    #[test]
    fn pause_and_resume_cycle() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        assert_eq!(client.try_activate(), Ok(Ok(())));
        assert_eq!(client.get_status(), Status::Active);

        client.pause();
        assert_eq!(client.get_status(), Status::Paused);

        client.resume();
        assert_eq!(client.get_status(), Status::Active);

        let result = client.try_resume();
        assert_eq!(result, Err(Ok(ContractError::InvalidState)));
    }

    #[test]
    fn cancel_blocks_lifecycle_transitions() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        client.activate();
        client.cancel();
        assert_eq!(client.get_status(), Status::Cancelled);

        assert_eq!(client.try_activate(), Err(Ok(ContractError::InvalidState)));
        assert_eq!(client.try_pause(), Err(Ok(ContractError::InvalidState)));
        assert_eq!(client.try_submit_milestone(&0), Err(Ok(ContractError::InvalidState)));
    }

    #[test]
    fn complete_requires_all_milestones() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        client.activate();
        client.submit_milestone(&0);
        client.approve_milestone(&0);
        client.complete_milestone(&0);

        let result = client.try_complete();
        assert_eq!(result, Err(Ok(ContractError::InvalidMilestoneState)));
        assert_eq!(client.get_status(), Status::Active);
    }

    #[test]
    fn reject_allows_no_illegal_transitions_after_rejection() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        client.activate();
        client.submit_milestone(&1);
        client.reject_milestone(&1);
        assert_eq!(client.get_milestone(&1).status, MilestoneStatus::Rejected);

        let submit = client.try_submit_milestone(&1);
        assert_eq!(submit, Err(Ok(ContractError::InvalidMilestoneState)));

        let approve = client.try_approve_milestone(&1);
        assert_eq!(approve, Err(Ok(ContractError::InvalidMilestoneState)));

        let complete = client.try_complete_milestone(&1);
        assert_eq!(complete, Err(Ok(ContractError::InvalidMilestoneState)));

        client.submit_milestone(&0);
        client.approve_milestone(&0);
        client.complete_milestone(&0);
        assert_eq!(client.get_milestone(&0).status, MilestoneStatus::Completed);
    }

    #[test]
    fn unknown_milestone_returns_not_found() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        let result = client.try_get_milestone(&99);
        assert_eq!(result, Err(Ok(ContractError::MilestoneNotFound)));
    }

    #[test]
    fn transfer_role_moves_authority() {
        let env = Env::default();
        let (client, _, _, _, arbiter) = setup(&env);
        let new_arbiter = Address::generate(&env);

        client.transfer_role(&Role::Arbiter, &new_arbiter);
        assert!(client.has_role(&new_arbiter, &Role::Arbiter));
        assert!(!client.has_role(&arbiter, &Role::Arbiter));

        let result = client.try_transfer_role(&Role::Factory, &new_arbiter);
        assert_eq!(result, Err(Ok(ContractError::InvalidRole)));
    }

    #[test]
    fn can_execute_reflects_role_permissions() {
        let env = Env::default();
        let (client, factory, funder, grantee, arbiter) = setup(&env);

        assert!(client.can_execute(&Action::Activate, &funder));
        assert!(!client.can_execute(&Action::Activate, &grantee));
        assert!(!client.can_execute(&Action::Activate, &arbiter));
        assert!(!client.can_execute(&Action::Activate, &factory));

        assert!(client.can_execute(&Action::SubmitMilestone, &grantee));
        assert!(!client.can_execute(&Action::SubmitMilestone, &funder));

        assert!(client.can_execute(&Action::ApproveMilestone, &arbiter));
        assert!(!client.can_execute(&Action::ApproveMilestone, &grantee));

        assert!(client.can_execute(&Action::UpdateMetadata, &funder));
        assert!(client.can_execute(&Action::TransferRole, &funder));
        assert!(client.can_execute(&Action::TransferRole, &grantee));
        assert!(client.can_execute(&Action::TransferRole, &arbiter));
        assert!(!client.can_execute(&Action::TransferRole, &factory));
    }

    #[test]
    fn archive_requires_completed_state() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        let result = client.try_archive();
        assert_eq!(result, Err(Ok(ContractError::InvalidState)));

        client.activate();
        let result = client.try_archive();
        assert_eq!(result, Err(Ok(ContractError::InvalidState)));
    }

    #[test]
    fn cancel_from_completed_state_is_rejected() {
        let env = Env::default();
        let (client, _, _, _, _) = setup(&env);

        client.activate();
        for id in 0..2 {
            client.submit_milestone(&id);
            client.approve_milestone(&id);
            client.complete_milestone(&id);
        }
        client.complete();

        let result = client.try_cancel();
        assert_eq!(result, Err(Ok(ContractError::InvalidState)));
        assert_eq!(client.get_status(), Status::Completed);
    }
}
