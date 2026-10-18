using IdentityService.DTOs;
using IdentityService.Models;
using IdentityService.Repositories;
using IdentityService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace CinnamonBistro.UnitTests.Authentication;

/// <summary>
/// Unit tests for <see cref="AuthService.RegisterAsync"/>: role / staff-code rules, email validation,
/// duplicate detection and the data handed to the repository. All I/O collaborators are mocked.
/// </summary>
public class AuthServiceRegisterTests
{
    private const string ConfiguredStaffCode = "TEST-STAFF-CODE";

    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IPasswordHasher> _hasher = new();
    private readonly Mock<IJwtTokenGenerator> _jwt = new();
    private readonly Mock<IEmailValidatorService> _emailValidator = new();
    private readonly AuthService _sut;

    public AuthServiceRegisterTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Staff:AuthorizationCode"] = ConfiguredStaffCode })
            .Build();

        _sut = new AuthService(
            _users.Object, _hasher.Object, _jwt.Object, _emailValidator.Object, config,
            NullLogger<AuthService>.Instance);

        // Happy-path defaults; individual tests override what they care about.
        _emailValidator.Setup(v => v.ValidateEmailDeliverabilityAsync(It.IsAny<string>())).Returns(Task.CompletedTask);
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>())).ReturnsAsync((User?)null);
        _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("hashed-password");
        _users.Setup(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>())).ReturnsAsync(7);
        _users.Setup(r => r.GetByIdAsync(7)).ReturnsAsync((User?)null);
    }

    private void StubCreatedUser(string role)
    {
        _users.Setup(r => r.GetByIdAsync(7)).ReturnsAsync(new User
        {
            UserId = 7,
            FullName = "Kamal Silva",
            Email = "kamal@example.com",
            PhoneNumber = "0711234567",
            IsActive = true,
            Status = "Active",
            Roles = new List<string> { role }
        });
    }

    private static RegisterRequestDto Request(string? role = "Customer", string? staffCode = null) => new()
    {
        FullName = "  Kamal Silva  ",
        Email = "  Kamal@Example.com ",
        PhoneNumber = "0711234567",
        Password = "Secret#123",
        Role = role,
        StaffAuthorizationCode = staffCode
    };

    // ---------- Positive ----------

    [Fact]
    public async Task RegisterAsync_ValidCustomer_HashesPasswordAndPersistsNormalisedUser()
    {
        StubCreatedUser("Customer");

        var response = await _sut.RegisterAsync(Request());

        Assert.Equal(7, response.UserId);
        Assert.Equal("kamal@example.com", response.Email);
        Assert.Equal(new[] { "Customer" }, response.Roles);

        // Behaviour: the entity handed to the repository is trimmed, lower-cased, hashed and active.
        _users.Verify(r => r.CreateUserWithRoleAsync(
            It.Is<User>(u =>
                u.FullName == "Kamal Silva" &&
                u.Email == "kamal@example.com" &&
                u.PasswordHash == "hashed-password" &&
                u.IsActive && u.Status == "Active"),
            "Customer"), Times.Once);
        _hasher.Verify(h => h.HashPassword("Secret#123"), Times.Once);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task RegisterAsync_MissingRole_DefaultsToCustomerWithoutNeedingStaffCode(string? role)
    {
        StubCreatedUser("Customer");

        await _sut.RegisterAsync(Request(role: role));

        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), "Customer"), Times.Once);
    }

    [Theory]
    [InlineData("Admin", ConfiguredStaffCode)]
    [InlineData("KitchenStaff", ConfiguredStaffCode)]
    [InlineData("admin", "  test-staff-code  ")] // role and code comparison ignore case/whitespace
    public async Task RegisterAsync_StaffRoleWithCorrectCode_IsAccepted(string role, string code)
    {
        StubCreatedUser(role);

        await _sut.RegisterAsync(Request(role, code));

        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), role), Times.Once);
    }

    // ---------- Negative: staff authorisation ----------

    [Theory]
    [InlineData("Admin", null)]
    [InlineData("Admin", "")]
    [InlineData("Admin", "WRONG-CODE")]
    [InlineData("KitchenStaff", "WRONG-CODE")]
    public async Task RegisterAsync_StaffRoleWithMissingOrWrongCode_ThrowsAndCreatesNothing(string role, string? code)
    {
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.RegisterAsync(Request(role, code)));

        Assert.Contains("staff authorization code", ex.Message, StringComparison.OrdinalIgnoreCase);
        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
        _emailValidator.Verify(v => v.ValidateEmailDeliverabilityAsync(It.IsAny<string>()), Times.Never);
    }

    // ---------- Negative: email ----------

    [Fact]
    public async Task RegisterAsync_EmailValidatorRejectsAddress_PropagatesErrorAndCreatesNothing()
    {
        _emailValidator
            .Setup(v => v.ValidateEmailDeliverabilityAsync(It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("Disposable email domains are not allowed."));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.RegisterAsync(Request()));

        Assert.Contains("Disposable", ex.Message);
        _users.Verify(r => r.GetByEmailAsync(It.IsAny<string>()), Times.Never);
        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_EmailAlreadyRegistered_ThrowsAndNeverHashesOrCreates()
    {
        _users.Setup(r => r.GetByEmailAsync(It.IsAny<string>())).ReturnsAsync(new User { UserId = 1, Email = "kamal@example.com" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.RegisterAsync(Request()));

        Assert.Contains("already exists", ex.Message);
        _hasher.Verify(h => h.HashPassword(It.IsAny<string>()), Times.Never);
        _users.Verify(r => r.CreateUserWithRoleAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
    }
}
