// https://github.com/makerdao/xdomain-dss/blob/a4644cbea9d146c5a509c748d9683fd8080facb4/src/Vat.sol

#[contract]
mod Vat {
    use starknet::ContractAddress;
    use starknet::StorageAccess;
    use starknet::StorageAddress;
    use starknet::StorageBaseAddress;
    use starknet::SyscallResult;
    use starknet::syscalls::storage_read_syscall;
    use starknet::syscalls::storage_write_syscall;
    use starknet::storage_address_from_base_and_offset;
    use starknet::storage_base_address_from_felt252;
     use starknet::get_caller_address;
    // use starknet::storage_address_to_felt252;
    extern fn storage_address_to_felt252(address: StorageAddress) -> felt252 nopanic;

    // type address = ContractAddress;
    // type Map = LegacyMap;
    type bytes = felt252;
    // type wad = u256;
    // type rad = u256;
    // type ray = u256;

    struct Ilk {
        Art: u256,    // Total Normalised Debt     [wad]
        rate: u256,   // Accumulated Rates         [ray]
        spot: u256,   // Price with Safety Margin  [ray]
        line: u256,   // Debt Ceiling              [rad]
        dust: u256    // Urn Debt Floor            [rad]
    }

    impl StorageAccessIlk of StorageAccess::<Ilk> {
        fn read(address_domain: u32, base: StorageBaseAddress) -> SyscallResult<Ilk> {
            Result::Ok(
                Ilk {
                    Art: StorageAccess::<u256>::read(address_domain, base)?,
                    // rate: storage_read_syscall(
                    //         address_domain, storage_address_from_base_and_offset(base, 1_u8)
                    //     )?,
                    rate: StorageAccess::<u256>::read(
                        address_domain,
                        storage_base_address_from_felt252(
                            storage_address_to_felt252(
                                storage_address_from_base_and_offset(base, 2_u8)
                            )
                        )
                    )?,
                    spot: StorageAccess::<u256>::read(
                        address_domain,
                        storage_base_address_from_felt252(
                            storage_address_to_felt252(
                                storage_address_from_base_and_offset(base, 4_u8)
                            )
                        )
                    )?,
                    line: StorageAccess::<u256>::read(
                        address_domain,
                        storage_base_address_from_felt252(
                            storage_address_to_felt252(
                                storage_address_from_base_and_offset(base, 6_u8)
                            )
                        )
                    )?,
                    dust: StorageAccess::<u256>::read(
                        address_domain,
                        storage_base_address_from_felt252(
                            storage_address_to_felt252(
                                storage_address_from_base_and_offset(base, 8_u8)
                            )
                        )
                    )?,
                }
            )
        }
        fn write(address_domain: u32, base: StorageBaseAddress, value: Ilk) -> SyscallResult<()> {
            StorageAccess::<u256>::write(address_domain, base, value.Art)?;
            StorageAccess::<u256>::write(
                address_domain,
                storage_base_address_from_felt252(
                    storage_address_to_felt252(
                        storage_address_from_base_and_offset(base, 2_u8)
                    )
                ),
                value.Art
            )?;
            StorageAccess::<u256>::write(
                address_domain,
                storage_base_address_from_felt252(
                    storage_address_to_felt252(
                        storage_address_from_base_and_offset(base, 2_u8)
                    )
                ),
                value.rate
            )?;
            StorageAccess::<u256>::write(
                address_domain,
                storage_base_address_from_felt252(
                    storage_address_to_felt252(
                        storage_address_from_base_and_offset(base, 2_u8)
                    )
                ),
                value.spot
            )?;
            StorageAccess::<u256>::write(
                address_domain,
                storage_base_address_from_felt252(
                    storage_address_to_felt252(
                        storage_address_from_base_and_offset(base, 2_u8)
                    )
                ),
                value.line
            )?;
            StorageAccess::<u256>::write(
                address_domain,
                storage_base_address_from_felt252(
                    storage_address_to_felt252(
                        storage_address_from_base_and_offset(base, 2_u8)
                    )
                ),
                value.dust
            )?;
            SyscallResult::Ok(())
        }
    }

    struct Urn {
        ink: u256,   // Locked Collateral  [wad]
        art: u256,   // Normalised Debt    [wad]
    }

    impl StorageAccessUrn of StorageAccess::<Urn> {
        fn read(address_domain: u32, base: StorageBaseAddress) -> SyscallResult<Urn> {
            Result::Ok(
                Urn {
                    ink: StorageAccess::<u256>::read(address_domain, base)?,
                    // rate: storage_read_syscall(
                    //         address_domain, storage_address_from_base_and_offset(base, 1_u8)
                    //     )?,
                    art: StorageAccess::<u256>::read(
                        address_domain,
                        storage_base_address_from_felt252(
                            storage_address_to_felt252(
                                storage_address_from_base_and_offset(base, 2_u8)
                            )
                        )
                    )?
                }
            )
        }
        fn write(address_domain: u32, base: StorageBaseAddress, value: Urn) -> SyscallResult<()> {
            StorageAccess::<u256>::write(address_domain, base, value.ink)?;
            StorageAccess::<u256>::write(
                address_domain,
                storage_base_address_from_felt252(
                    storage_address_to_felt252(
                        storage_address_from_base_and_offset(base, 2_u8)
                    )
                ),
                value.art
            )?;
            SyscallResult::Ok(())
        }
    }

    struct Storage {
        wards: LegacyMap::<ContractAddress, bool>,
        can: LegacyMap::<(ContractAddress, ContractAddress), bool>,

        ilks: LegacyMap::<bytes, Ilk>,
        urns: LegacyMap::<(bytes, ContractAddress), Urn>,
        gem: LegacyMap::<(bytes, ContractAddress), u256>,
        dai: LegacyMap::<ContractAddress, u256>,
        sin: LegacyMap::<ContractAddress, u256>,

        debt: u256,  // Total Dai Issued    [rad]
        suft: u256,  // Total Dai Bridged   [rad]
        vice: u256,  // Total Unbacked Dai  [rad]
        Line: u256,  // Total Debt Ceiling  [rad]
        live: bool,  // Active Flag
    }


    // mapping (address => uint256) public wards;

    // mapping(address => mapping (address => uint256)) public can;

    // struct Ilk {
    //     uint256 Art;   // Total Normalised Debt     [wad]
    //     uint256 rate;  // Accumulated Rates         [ray]
    //     uint256 spot;  // Price with Safety Margin  [ray]
    //     uint256 line;  // Debt Ceiling              [rad]
    //     uint256 dust;  // Urn Debt Floor            [rad]
    // }
    // struct Urn {
    //     uint256 ink;   // Locked Collateral  [wad]
    //     uint256 art;   // Normalised Debt    [wad]
    // }

    // mapping (bytes32 => Ilk)                            public ilks;
    // mapping (bytes32 => mapping (address => Urn))       public urns;
    // mapping (bytes32 => mapping (address => uint256))   public gem;  // [wad]
    // mapping (address => uint256)                        public dai;  // [rad]
    // mapping (address => uint256)                        public sin;  // [rad]

    // uint256 public debt;  // Total Dai Issued    [rad]
    // int256  public surf;  // Total Dai Bridged   [rad]
    // uint256 public vice;  // Total Unbacked Dai  [rad]
    // uint256 public Line;  // Total Debt Ceiling  [rad]
    // uint256 public live;  // Active Flag

    // TODO: add events

    // function wish(address bit, address usr) internal view returns (bool) {
    //     return either(bit == usr, can[bit][usr] == 1);
    // }
    fn wish(bit: ContractAddress, usr: ContractAddress) -> bool {
        bit == usr | can::read((bit, usr))
    }

    // TODO: let's pretend it exists
    type i256 = u256;

    fn zero() -> u256 {
        u256 { low: 0_u128, high: 0_u128}
    }

    fn either(a: bool, b: bool) -> bool {
        a | b
    }

    fn both(a: bool, b: bool) -> bool {
        a & b
    }


    //    function frob(bytes32 i, address u, address v, address w, int256 dink, int256 dart) external {
    #[external]
    fn frob(i: bytes, u: ContractAddress, v: ContractAddress, w: ContractAddress, dink: i256, dart: i256) {
        //     // system is live
        //     require(live == 1, "Vat/not-live");
        assert(live::read(), 'Vat/not-live');

        //     uint256 rate_ = ilks[i].rate;
        //     // ilk has been initialised
        //     require(rate_ != 0, "Vat/ilk-not-init");
        let mut ilk: Ilk = ilks::read(i);
        assert(ilk.rate != zero(), 'Vat/ilk-not-init');

        //     Urn memory urn = urns[i][u];
        //     urn.ink = _add(urn.ink, dink);
        //     urn.art = _add(urn.art, dart);
        let mut urn: Urn = urns::read((i, u));
        urn.ink += dink;
        urn.art += dart;

        //     uint256 Art_  = _add(ilks[i].Art, dart);
        //     int256  dtab  = _int256(rate_) * dart;
        //     uint256 debt_ = _add(debt, dtab);
        ilk.Art += dart;
        let dtab = ilk.rate * dart;
        let debt_ = debt::read() + dtab;


        //     // either debt has decreased, or debt ceilings are not exceeded
        //     require(either(dart <= 0, both(Art_ * rate_ <= ilks[i].line, debt_ <= Line)), "Vat/ceiling-exceeded");
        assert(either(dart <= zero(), both(ilk.Art * ilk.rate <= ilk.line, debt_ <= Line::read())), 'Vat/ceiling-exceeded');

        //     uint256 tab = rate_ * urn.art;
        //     // urn is either less risky than before, or it is safe
        //     require(either(both(dart <= 0, dink >= 0), tab <= urn.ink * ilks[i].spot), "Vat/not-safe");
        let tab = ilk.rate * urn.art;
        assert(either(both(dart <= zero(), dink >= zero()), tab <= urn.ink * ilk.spot), 'Vat/not-safe');

        //     // urn is either more safe, or the owner consents
        //     require(either(both(dart <= 0, dink >= 0), wish(u, msg.sender)), "Vat/not-allowed-u");
        let caller =  get_caller_address();
        assert(either(both(dart <= zero(), dink >= zero()), wish(u, caller)), 'Vat/not-allowed-u');

        //     // collateral src consents
        //     require(either(dink <= 0, wish(v, msg.sender)), "Vat/not-allowed-v");
        assert(either(dink <= zero(), wish(v, caller)), 'Vat/not-allowed-v');

        //     // debt dst consents
        //     require(either(dart >= 0, wish(w, msg.sender)), "Vat/not-allowed-w");
        assert(either(dart >= zero(), wish(w, caller)), 'Vat/not-allowed-w');

        //     // urn has no debt, or a non-dusty amount
        //     require(either(urn.art == 0, tab >= ilks[i].dust), "Vat/dust");
        assert(either(urn.art == zero(), tab >= ilk.dust), 'Vat/dust');

        //     // update storage values
        //     gem[i][v]   = _sub(gem[i][v], dink);
        gem::write((i, v), gem::read((i, v)) - dink);

        //     dai[w]      = _add(dai[w],    dtab);
        dai::write(w, dai::read(w) + dtab);

        //     urns[i][u]  = urn;
        urns::write((i, u), urn);

        //     ilks[i].Art = Art_;
        ilks::write(i, ilk);

        //     debt        = debt_;
        debt::write(debt_);

        //     emit Frob(i, u, v, w, dink, dart);
    }

}
